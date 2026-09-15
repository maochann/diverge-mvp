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
import { fetchFollowingIds, follow, unfollow } from '@/services/follows';

interface FollowContextValue {
  /**
   * Ids the signed-in user follows. `null` until loaded (or when loading
   * failed) — callers that need the set must not fall back to "everyone".
   */
  following: ReadonlySet<string> | null;
  /** Why `following` is null, when it is because loading failed. */
  loadError: string | null;
  isFollowing: (userId: string) => boolean;
  /** True while a follow/unfollow request for this person is in flight. */
  isPending: (userId: string) => boolean;
  /** Flip follow state. Optimistic; throws (after rolling back) on failure. */
  toggleFollow: (userId: string) => Promise<void>;
  /**
   * Re-read the set from the server (e.g. on pull-to-refresh). Resolves with
   * the fresh set so callers don't have to wait for a re-render to use it.
   */
  reload: () => Promise<ReadonlySet<string> | null>;
}

const FollowContext = createContext<FollowContextValue | null>(null);

interface LoadedSet {
  userId: string;
  ids: Set<string> | null;
  error: string | null;
}

/**
 * The signed-in user's follow set, kept in memory for the session. The server
 * is the only source of truth: nothing is persisted on the device, so logging
 * out and back in (or switching accounts) always starts from a fresh read.
 */
export function FollowProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [loaded, setLoaded] = useState<LoadedSet | null>(null);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  // Serialises toggles per person so a quick double tap can't interleave.
  const inFlight = useRef(new Set<string>());

  const load = useCallback(async (forUser: string) => {
    try {
      const ids = new Set(await fetchFollowingIds(forUser));
      setLoaded({ userId: forUser, ids, error: null });
      return ids;
    } catch (e) {
      setLoaded({
        userId: forUser,
        ids: null,
        error: e instanceof Error ? e.message : 'Could not load who you follow.',
      });
      return null;
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchFollowingIds(userId)
      .then((ids) => {
        if (!cancelled) setLoaded({ userId, ids: new Set(ids), error: null });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoaded({
            userId,
            ids: null,
            error: e instanceof Error ? e.message : 'Could not load who you follow.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Derived: a set only counts if it belongs to the signed-in user.
  const current = userId && loaded?.userId === userId ? loaded : null;
  const following = current?.ids ?? null;
  const loadError = current?.error ?? null;

  const isFollowing = useCallback(
    (target: string) => following?.has(target) ?? false,
    [following],
  );
  const isPending = useCallback((target: string) => pending.has(target), [pending]);

  const toggleFollow = useCallback(
    async (target: string) => {
      if (!userId || target === userId) return;
      if (inFlight.current.has(target)) return;
      const wasFollowing = following?.has(target) ?? false;

      inFlight.current.add(target);
      setPending((p) => new Set(p).add(target));
      // Optimistic: flip locally first, revert if the server disagrees.
      setLoaded((s) => {
        if (!s || s.userId !== userId) return s;
        const ids = new Set(s.ids ?? []);
        if (wasFollowing) ids.delete(target);
        else ids.add(target);
        return { ...s, ids, error: null };
      });
      try {
        if (wasFollowing) await unfollow(userId, target);
        else await follow(userId, target);
      } catch (e) {
        setLoaded((s) => {
          if (!s || s.userId !== userId) return s;
          const ids = new Set(s.ids ?? []);
          if (wasFollowing) ids.add(target);
          else ids.delete(target);
          return { ...s, ids };
        });
        throw e;
      } finally {
        inFlight.current.delete(target);
        setPending((p) => {
          const next = new Set(p);
          next.delete(target);
          return next;
        });
      }
    },
    [userId, following],
  );

  const reload = useCallback(async () => {
    return userId ? load(userId) : null;
  }, [userId, load]);

  const value = useMemo<FollowContextValue>(
    () => ({ following, loadError, isFollowing, isPending, toggleFollow, reload }),
    [following, loadError, isFollowing, isPending, toggleFollow, reload],
  );

  return <FollowContext.Provider value={value}>{children}</FollowContext.Provider>;
}

export function useFollows(): FollowContextValue {
  const ctx = useContext(FollowContext);
  if (!ctx) throw new Error('useFollows must be used inside FollowProvider');
  return ctx;
}
