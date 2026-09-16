import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/lib/auth-context';
import { decisionHaptic } from '@/lib/haptics';
import {
  addRelation,
  blockUser,
  fetchRelationIds,
  removeRelation,
  type RelationKind,
} from '@/services/relations';

type IdSet = ReadonlySet<string>;

interface RelationSets {
  following: IdSet;
  muted: IdSet;
  blocked: IdSet;
}

interface RelationsContextValue {
  /**
   * The signed-in user's follow / mute / block sets. `null` until loaded (or
   * when loading failed) — callers must not fall back to "everyone".
   */
  sets: RelationSets | null;
  /** Why `sets` is null, when it is because loading failed. */
  loadError: string | null;
  isFollowing: (userId: string) => boolean;
  isMuted: (userId: string) => boolean;
  isBlocked: (userId: string) => boolean;
  /** True while any request for this person is in flight. */
  isPending: (userId: string) => boolean;
  /** Flip follow state. Optimistic; throws (after rolling back) on failure. */
  toggleFollow: (userId: string) => Promise<void>;
  /** Flip mute state. Optimistic; throws (after rolling back) on failure. */
  toggleMute: (userId: string) => Promise<void>;
  /** Block: server-side transaction, then the local sets are updated. */
  block: (userId: string) => Promise<void>;
  unblock: (userId: string) => Promise<void>;
  /** Re-read all sets from the server. Resolves with the fresh sets. */
  reload: () => Promise<RelationSets | null>;
}

const RelationsContext = createContext<RelationsContextValue | null>(null);

interface Loaded {
  userId: string;
  sets: RelationSets | null;
  error: string | null;
}

async function loadSets(userId: string): Promise<RelationSets> {
  const [following, muted, blocked] = await Promise.all([
    fetchRelationIds('follow', userId),
    fetchRelationIds('mute', userId),
    fetchRelationIds('block', userId),
  ]);
  return { following: new Set(following), muted: new Set(muted), blocked: new Set(blocked) };
}

const SET_KEY: Record<RelationKind, keyof RelationSets> = {
  follow: 'following',
  mute: 'muted',
  block: 'blocked',
};

function withMember(sets: RelationSets, key: keyof RelationSets, id: string, present: boolean) {
  const next = new Set(sets[key]);
  if (present) next.add(id);
  else next.delete(id);
  return { ...sets, [key]: next };
}

/**
 * The signed-in user's relations, kept in memory for the session. The server
 * is the only source of truth: nothing is persisted on the device, so logging
 * out and back in (or switching accounts) always starts from a fresh read.
 */
export function RelationsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [pending, setPending] = useState<IdSet>(new Set());
  // Serialises requests per person so a quick double tap can't interleave.
  const inFlight = useRef(new Set<string>());

  const load = useCallback(async (forUser: string) => {
    try {
      const sets = await loadSets(forUser);
      setLoaded({ userId: forUser, sets, error: null });
      return sets;
    } catch (e) {
      setLoaded({
        userId: forUser,
        sets: null,
        error: e instanceof Error ? e.message : 'Could not load your settings.',
      });
      return null;
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadSets(userId)
      .then((sets) => {
        if (!cancelled) setLoaded({ userId, sets, error: null });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoaded({
            userId,
            sets: null,
            error: e instanceof Error ? e.message : 'Could not load your settings.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Derived: sets only count if they belong to the signed-in user.
  const current = userId && loaded?.userId === userId ? loaded : null;
  const sets = current?.sets ?? null;
  const loadError = current?.error ?? null;

  const has = useCallback(
    (key: keyof RelationSets, target: string) => sets?.[key].has(target) ?? false,
    [sets],
  );
  const isFollowing = useCallback((t: string) => has('following', t), [has]);
  const isMuted = useCallback((t: string) => has('muted', t), [has]);
  const isBlocked = useCallback((t: string) => has('blocked', t), [has]);
  const isPending = useCallback((t: string) => pending.has(t), [pending]);

  const markPending = (target: string, on: boolean) => {
    if (on) inFlight.current.add(target);
    else inFlight.current.delete(target);
    setPending((p) => {
      const next = new Set(p);
      if (on) next.add(target);
      else next.delete(target);
      return next;
    });
  };

  const patch = useCallback(
    (key: keyof RelationSets, target: string, present: boolean) => {
      setLoaded((s) =>
        s && s.userId === userId && s.sets
          ? { ...s, sets: withMember(s.sets, key, target, present) }
          : s,
      );
    },
    [userId],
  );

  /** Optimistic toggle for follow and mute (both idempotent on the server). */
  const toggle = useCallback(
    async (kind: 'follow' | 'mute', target: string) => {
      if (!userId || target === userId || inFlight.current.has(target)) return;
      const key = SET_KEY[kind];
      const was = sets?.[key].has(target) ?? false;
      markPending(target, true);
      patch(key, target, !was);
      try {
        if (was) await removeRelation(kind, userId, target);
        else await addRelation(kind, userId, target);
        // Choosing to follow someone is a decision; unfollowing is quiet.
        if (kind === 'follow' && !was) decisionHaptic();
      } catch (e) {
        patch(key, target, was);
        throw e;
      } finally {
        markPending(target, false);
      }
    },
    [userId, sets, patch],
  );

  const toggleFollow = useCallback((t: string) => toggle('follow', t), [toggle]);
  const toggleMute = useCallback((t: string) => toggle('mute', t), [toggle]);

  /**
   * Blocking is not optimistic: it is a safety action whose side effects
   * (dropping follows and mutes both ways) happen on the server first.
   */
  const block = useCallback(
    async (target: string) => {
      if (!userId || target === userId || inFlight.current.has(target)) return;
      markPending(target, true);
      try {
        await blockUser(target);
        setLoaded((s) => {
          if (!s || s.userId !== userId || !s.sets) return s;
          let next = withMember(s.sets, 'blocked', target, true);
          next = withMember(next, 'following', target, false);
          next = withMember(next, 'muted', target, false);
          return { ...s, sets: next };
        });
      } finally {
        markPending(target, false);
      }
    },
    [userId],
  );

  const unblock = useCallback(
    async (target: string) => {
      if (!userId || inFlight.current.has(target)) return;
      markPending(target, true);
      patch('blocked', target, false);
      try {
        await removeRelation('block', userId, target);
      } catch (e) {
        patch('blocked', target, true);
        throw e;
      } finally {
        markPending(target, false);
      }
    },
    [userId, patch],
  );

  const reload = useCallback(async () => (userId ? load(userId) : null), [userId, load]);

  const value = useMemo<RelationsContextValue>(
    () => ({
      sets,
      loadError,
      isFollowing,
      isMuted,
      isBlocked,
      isPending,
      toggleFollow,
      toggleMute,
      block,
      unblock,
      reload,
    }),
    [
      sets,
      loadError,
      isFollowing,
      isMuted,
      isBlocked,
      isPending,
      toggleFollow,
      toggleMute,
      block,
      unblock,
      reload,
    ],
  );

  return <RelationsContext.Provider value={value}>{children}</RelationsContext.Provider>;
}

export function useRelations(): RelationsContextValue {
  const ctx = useContext(RelationsContext);
  if (!ctx) throw new Error('useRelations must be used inside RelationsProvider');
  return ctx;
}
