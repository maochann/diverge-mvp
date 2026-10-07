import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  runOnJS,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';

import { ChapterDivider } from '@/components/chapter-divider';
import { ChapterEnd } from '@/components/chapter-end';
import { FeedIntentPicker } from '@/components/feed-intent-picker';
import { MessageState } from '@/components/message-state';
import { PostCard } from '@/components/post-card';
import { PostSkeletonList } from '@/components/post-skeleton';
import { PULL_THRESHOLD, PullFork } from '@/components/pull-fork';
import { ExploreCanvas } from '@/components/explore-canvas';
import {
  CHAPTER_SIZE,
  MIX_ADJACENT_ENABLED,
  MIX_OUTSIDE_COUNT,
  type FeedIntent,
} from '@/constants/feed';
import { Motion } from '@/constants/theme';
import { useT, type Translate } from '@/i18n';
import {
  markSeen,
  nextRound,
  peopleFromItems,
  postForRound,
  type ExploreSession,
} from '@/lib/explore-session';
import { useFeedIntent } from '@/lib/feed-intent';
import { decisionHaptic } from '@/lib/haptics';
import { composeMixChapter, mergeOutsidePool, type OutsideSource } from '@/lib/feed-mix';
import { rankAdjacent } from '@/lib/adjacent';
import { fetchAdjacentForChapter } from '@/services/adjacent';
import { useAuth } from '@/lib/auth-context';
import { useRelations } from '@/lib/relations-context';
import { errorMessage } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import {
  countOtherProfiles,
  deletePost,
  fetchExploreChapter,
  fetchFollowedChapter,
  fetchPostsByIds,
  setLiked,
  type ExploreCursor,
  type ExploreItem,
  type FeedCursor,
} from '@/services/posts';
import type { FeedPost } from '@/types';

/**
 * One reading session: the chapters seen so far and where the next one
 * starts. Lives only in memory — pull-to-refresh, a new intent, logout or an
 * app restart begin a new session from the newest posts.
 *
 * Every session is a snapshot: `cutoff` is when it began, and posts created
 * after that wait for the next session. Follow changes made while reading
 * don't rewrite the chapters on screen either; they apply from the next
 * chapter fetched.
 */
interface SessionBase {
  chapters: FeedPost[][];
  /** A line explaining a chapter's composition, per chapter (null = nothing to say). */
  notes: (string | null)[];
  cutoff: string;
  /** Set when a chapter came back empty, to pick the right empty state. */
  othersCount: number | null;
}

interface CatchUpSession extends SessionBase {
  intent: 'catch_up';
  cursor: FeedCursor | null;
  hasMore: boolean;
}

interface MixSession extends SessionBase {
  intent: 'mix_it_up';
  followed: { cursor: FeedCursor | null; hasMore: boolean };
  outside: { cursor: ExploreCursor | null; hasMore: boolean };
  /** Ids of posts that came from outside the reader's circle (for the provenance line). */
  outsideIds: Set<string>;
}

type FeedSession = CatchUpSession | ExploreSession | MixSession;

/** How many posts to pull for an Explore snapshot: ~20 people × a few rounds. */
const EXPLORE_SNAPSHOT_SIZE = 60;
const EXPLORE_SNAPSHOT_PAGES = 3;

type MixOutside = OutsideSource<FeedPost, ExploreItem>;

function outsidePost(o: MixOutside): FeedPost {
  return o.source === 'adjacent' ? o.post : o.item.post;
}

/**
 * Outside voices for a Mix chapter: posts related (same prompt, same fork
 * origin, branched from) to the chapter's followed posts come first, then
 * the people-balanced Explore page. Related posts by anyone followed, muted
 * or the reader are never candidates. Best effort: on failure the Explore
 * pool alone is used, exactly as before.
 */
async function mixOutsidePool(
  viewerId: string,
  followedPosts: FeedPost[],
  explore: ExploreItem[],
  cutoff: string,
  following: ReadonlySet<string>,
  muted: ReadonlySet<string>,
  seen: ReadonlySet<string>,
): Promise<MixOutside[]> {
  let adjacent: FeedPost[] = [];
  if (MIX_ADJACENT_ENABLED && followedPosts.length > 0) {
    try {
      const raw = await fetchAdjacentForChapter(followedPosts, viewerId, cutoff, following);
      adjacent = rankAdjacent(raw, {
        viewerId,
        subjectId: '',
        following,
        muted,
        limit: MIX_OUTSIDE_COUNT,
      }).map((c) => c.post);
    } catch {
      adjacent = [];
    }
  }
  return mergeOutsidePool(adjacent, explore, seen);
}

/** The Explore cursor after a Mix chapter: past the last Explore-pool item used. */
function exploreCursorAfter(used: MixOutside[]): ExploreCursor | null {
  for (let i = used.length - 1; i >= 0; i--) {
    const o = used[i];
    if (o.source === 'explore') return o.item.cursor;
  }
  return null;
}

function sessionHasMore(s: CatchUpSession | MixSession): boolean {
  return s.intent === 'mix_it_up' ? s.followed.hasMore || s.outside.hasMore : s.hasMore;
}

type Row =
  | {
      kind: 'post';
      key: string;
      post: FeedPost;
      outside: boolean;
      /** Part of the chapter the reader just opened (animates in). */
      fresh: boolean;
      /** Row index where this post's chapter starts, for the stagger. */
      chapterStart: number;
    }
  | { kind: 'divider'; key: string; chapter: number; note: string | null };

function toRows(
  chapters: FeedPost[][],
  notes: (string | null)[],
  outsideIds: ReadonlySet<string>,
  freshChapter: number | null,
): Row[] {
  const rows: Row[] = [];
  chapters.forEach((chapter, index) => {
    if (chapter.length === 0) return;
    rows.push({
      kind: 'divider',
      key: `chapter-${index + 1}`,
      chapter: index + 1,
      note: notes[index] ?? null,
    });
    const chapterStart = rows.length;
    for (const post of chapter) {
      rows.push({
        kind: 'post',
        key: post.id,
        post,
        outside: outsideIds.has(post.id),
        fresh: index + 1 === freshChapter,
        chapterStart,
      });
    }
  });
  return rows;
}

function mapPosts(
  chapters: FeedPost[][],
  fn: (post: FeedPost) => FeedPost | null,
): FeedPost[][] {
  return chapters.map((chapter) =>
    chapter.flatMap((post) => {
      const next = fn(post);
      return next ? [next] : [];
    }),
  );
}

/** What to say above a Mix chapter when one side of the mix is empty. */
function mixNote(
  t: Translate,
  followedCount: number,
  outsideCount: number,
  followingAnyone: boolean,
) {
  if (followedCount + outsideCount === 0) return null;
  if (followedCount === 0) {
    return followingAnyone ? t('feed.mixNote.noneFromCircle') : t('feed.mixNote.emptyCircle');
  }
  if (outsideCount === 0) {
    return t('feed.mixNote.allCircle');
  }
  return t('feed.mixNote.split', { followed: followedCount, outside: outsideCount });
}

export default function FeedScreen() {
  const { session: auth, profile } = useAuth();
  const { colors } = useTheme();
  const t = useT();
  const userId = auth?.user.id ?? '';
  const { intent, setIntent, ready: intentReady } = useFeedIntent(userId);
  const { sets, loadError: followError, reload: reloadRelations } = useRelations();
  // Catch up reads from people you follow, minus anyone you've muted.
  const following = useMemo(
    () => (sets ? new Set([...sets.following].filter((id) => !sets.muted.has(id))) : null),
    [sets],
  );

  const [session, setSession] = useState<FeedSession | null>(null);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [nextError, setNextError] = useState<string | null>(null);
  const [loadingNext, setLoadingNext] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Pull-to-refresh: how far the list is pulled past its top, 1 = threshold.
  const pull = useSharedValue(0);
  const refreshingRef = useRef(false);
  // The chapter number the reader most recently opened; it animates in.
  const [freshChapter, setFreshChapter] = useState<number | null>(null);
  // Bumps whenever a new session starts so the content can cross-fade.
  const [sessionKey, setSessionKey] = useState(0);
  // Latest values for callbacks that must not re-subscribe on every change
  // (the focus effect in particular).
  const sessionRef = useRef<FeedSession | null>(null);
  const followingRef = useRef<ReadonlySet<string> | null>(null);
  const mutedRef = useRef<ReadonlySet<string>>(new Set());
  const starting = useRef(false);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    followingRef.current = following;
    mutedRef.current = sets?.muted ?? new Set();
  }, [following, sets]);

  /** Start (or restart) a session from the newest posts. */
  const startSession = useCallback(
    async (forIntent: FeedIntent, ids: ReadonlySet<string> | null = followingRef.current) => {
      if (starting.current) return;
      starting.current = true;
      try {
        setInitialError(null);
        setFreshChapter(null);
        setSessionKey((k) => k + 1);
        const cutoff = new Date().toISOString();
        const authorIds = [...(ids ?? [])];

        if (forIntent === 'catch_up') {
          const chapter = await fetchFollowedChapter(userId, {
            authorIds,
            cutoff,
            limit: CHAPTER_SIZE,
          });
          setSession({
            intent: 'catch_up',
            chapters: [chapter.posts],
            notes: [null],
            cutoff,
            cursor: chapter.nextCursor,
            hasMore: chapter.hasMore,
            othersCount: null,
          });
        } else if (forIntent === 'explore') {
          // Snapshot everyone outside the circle with a few posts each.
          let effectiveCutoff = cutoff;
          let after: ExploreCursor | null = null;
          const items: ExploreItem[] = [];
          for (let page = 0; page < EXPLORE_SNAPSHOT_PAGES; page++) {
            const chapter = await fetchExploreChapter(userId, {
              cutoff: effectiveCutoff,
              after,
              limit: EXPLORE_SNAPSHOT_SIZE,
            });
            effectiveCutoff = chapter.cutoff;
            items.push(...chapter.items);
            after = chapter.nextCursor;
            if (!chapter.hasMore) break;
          }
          const people = peopleFromItems(items);
          setSession({
            intent: 'explore',
            cutoff: effectiveCutoff,
            round: 1,
            people,
            seen: new Set(),
            othersCount: people.length === 0 ? await countOtherProfiles(userId) : null,
          });
        } else {
          const [followed, outside] = await Promise.all([
            fetchFollowedChapter(userId, { authorIds, cutoff, limit: CHAPTER_SIZE }),
            fetchExploreChapter(userId, { cutoff, limit: CHAPTER_SIZE }),
          ]);
          const pool = await mixOutsidePool(
            userId,
            followed.posts,
            outside.items,
            outside.cutoff,
            ids ?? new Set(),
            mutedRef.current,
            new Set(),
          );
          const mix = composeMixChapter(followed.posts, pool);
          const posts = mix.items.map((i) => (i.kind === 'followed' ? i.item : outsidePost(i.item)));
          const usedO = mix.items.flatMap((i) => (i.kind === 'outside' ? [i.item] : []));
          const exploreUsed = usedO.filter((o) => o.source === 'explore').length;
          const lastF = followed.posts[mix.usedFollowed - 1];
          setSession({
            intent: 'mix_it_up',
            chapters: [posts],
            notes: [mixNote(t, mix.usedFollowed, mix.usedOutside, authorIds.length > 0)],
            cutoff: outside.cutoff,
            followed: {
              cursor: lastF ? { created_at: lastF.created_at, id: lastF.id } : null,
              hasMore: followed.hasMore || followed.posts.length > mix.usedFollowed,
            },
            outside: {
              cursor: exploreCursorAfter(usedO),
              hasMore: outside.hasMore || outside.items.length > exploreUsed,
            },
            outsideIds: new Set(usedO.map((o) => outsidePost(o).id)),
            othersCount: posts.length === 0 ? await countOtherProfiles(userId) : null,
          });
        }
        setNextError(null);
      } catch (e) {
        setInitialError(errorMessage(e));
      } finally {
        starting.current = false;
      }
    },
    [userId, t],
  );

  /**
   * Bring like/comment counts up to date for posts already on screen without
   * changing which posts are shown. Posts deleted elsewhere drop out.
   */
  const refreshCounts = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || current.intent === 'explore') return;
    const ids = current.chapters.flat().map((p) => p.id);
    if (ids.length === 0) return;
    try {
      const fresh = new Map((await fetchPostsByIds(ids, userId)).map((p) => [p.id, p]));
      setSession((s) =>
        s && s.intent !== 'explore'
          ? { ...s, chapters: mapPosts(s.chapters, (p) => fresh.get(p.id) ?? null) }
          : s,
      );
    } catch {
      // Counts are best-effort; the chapter itself is still valid.
    }
  }, [userId]);

  // Catch up and Mix need to know who is followed before they can start.
  const canStart = intentReady && (intent === 'explore' || following !== null);

  useFocusEffect(
    useCallback(() => {
      if (!canStart) return;
      if (sessionRef.current === null) {
        void startSession(intent);
      } else {
        void refreshCounts();
      }
      // `intent` is read once here on purpose: changing it goes through
      // handleIntentChange, which restarts the session itself.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canStart, startSession, refreshCounts]),
  );

  const handleRefresh = async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    // Who you follow may have changed elsewhere; the new session should know.
    const fresh = await reloadRelations();
    const ids = fresh
      ? new Set([...fresh.following].filter((id) => !fresh.muted.has(id)))
      : null;
    if (intent === 'explore' || ids !== null) await startSession(intent, ids);
    setRefreshing(false);
    refreshingRef.current = false;
  };

  const startRefresh = () => {
    void handleRefresh();
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      pull.value = Math.max(0, -event.contentOffset.y) / PULL_THRESHOLD;
    },
    onEndDrag: (event) => {
      if (-event.contentOffset.y >= PULL_THRESHOLD) {
        runOnJS(startRefresh)();
      }
    },
  });

  /** A new intent is a new reading session: back to the top, chapter one. */
  const handleIntentChange = async (next: FeedIntent) => {
    if (next === intent) return;
    setIntent(next);
    setSession(null);
    if (next === 'explore' || followingRef.current !== null) await startSession(next);
  };

  const handleNextChapter = async () => {
    const current = session;
    if (!current || current.intent === 'explore' || !sessionHasMore(current) || loadingNext) {
      return;
    }
    setLoadingNext(true);
    setNextError(null);
    decisionHaptic();
    setFreshChapter(current.chapters.length + 1);
    try {
      // Belt and braces: the cursors already guarantee no repeats within a
      // pool, and this also covers a post moving pools after a follow change.
      const seen = new Set(current.chapters.flat().map((p) => p.id));
      const authorIds = [...(followingRef.current ?? [])];

      if (current.intent === 'catch_up') {
        const chapter = await fetchFollowedChapter(userId, {
          authorIds,
          cutoff: current.cutoff,
          before: current.cursor,
          limit: CHAPTER_SIZE,
        });
        const posts = chapter.posts.filter((p) => !seen.has(p.id));
        setSession((s) =>
          s && s.intent === 'catch_up'
            ? {
                ...s,
                chapters: posts.length > 0 ? [...s.chapters, posts] : s.chapters,
                notes: posts.length > 0 ? [...s.notes, null] : s.notes,
                cursor: chapter.nextCursor ?? s.cursor,
                hasMore: chapter.hasMore,
              }
            : s,
        );
      } else {
        const [followed, outside] = await Promise.all([
          current.followed.hasMore
            ? fetchFollowedChapter(userId, {
                authorIds,
                cutoff: current.cutoff,
                before: current.followed.cursor,
                limit: CHAPTER_SIZE,
              })
            : Promise.resolve({ posts: [], hasMore: false, nextCursor: null }),
          current.outside.hasMore
            ? fetchExploreChapter(userId, {
                cutoff: current.cutoff,
                after: current.outside.cursor,
                limit: CHAPTER_SIZE,
              })
            : Promise.resolve({
                items: [],
                hasMore: false,
                nextCursor: null,
                cutoff: current.cutoff,
              }),
        ]);
        const freshFollowed = followed.posts.filter((p) => !seen.has(p.id));
        const pool = await mixOutsidePool(
          userId,
          freshFollowed,
          outside.items,
          current.cutoff,
          followingRef.current ?? new Set(),
          mutedRef.current,
          seen,
        );
        const mix = composeMixChapter(freshFollowed, pool);
        const posts = mix.items.map((i) => (i.kind === 'followed' ? i.item : outsidePost(i.item)));
        const usedF = mix.items.flatMap((i) => (i.kind === 'followed' ? [i.item] : []));
        const usedO = mix.items.flatMap((i) => (i.kind === 'outside' ? [i.item] : []));
        const exploreUsed = usedO.filter((o) => o.source === 'explore').length;
        const lastF = usedF[usedF.length - 1];
        const nextExploreCursor = exploreCursorAfter(usedO);
        setSession((s) =>
          s && s.intent === 'mix_it_up'
            ? {
                ...s,
                chapters: posts.length > 0 ? [...s.chapters, posts] : s.chapters,
                notes:
                  posts.length > 0
                    ? [...s.notes, mixNote(t, mix.usedFollowed, mix.usedOutside, authorIds.length > 0)]
                    : s.notes,
                followed: {
                  cursor: lastF ? { created_at: lastF.created_at, id: lastF.id } : s.followed.cursor,
                  hasMore: followed.hasMore || followed.posts.length > mix.usedFollowed,
                },
                outside: {
                  cursor: nextExploreCursor ?? s.outside.cursor,
                  hasMore: outside.hasMore || outside.items.length > exploreUsed,
                },
                outsideIds: new Set([...s.outsideIds, ...usedO.map((o) => outsidePost(o).id)]),
              }
            : s,
        );
      }
    } catch (e) {
      setNextError(errorMessage(e));
    } finally {
      setLoadingNext(false);
    }
  };

  const handleToggleLike = async (post: FeedPost) => {
    const nextLiked = !post.liked_by_me;
    const patched: FeedPost = {
      ...post,
      liked_by_me: nextLiked,
      like_count: post.like_count + (nextLiked ? 1 : -1),
    };
    // Optimistic update; reverted if the request fails.
    setSession((s) =>
      s && s.intent !== 'explore'
        ? { ...s, chapters: mapPosts(s.chapters, (p) => (p.id === post.id ? patched : p)) }
        : s,
    );
    try {
      await setLiked(post.id, userId, nextLiked);
    } catch (e) {
      setSession((s) =>
        s && s.intent !== 'explore'
          ? { ...s, chapters: mapPosts(s.chapters, (p) => (p.id === post.id ? post : p)) }
          : s,
      );
      Alert.alert(t('feed.likeFailed'), errorMessage(e));
    }
  };

  const handleDelete = async (post: FeedPost) => {
    try {
      await deletePost(post.id);
      setSession((s) =>
        s && s.intent !== 'explore'
          ? { ...s, chapters: mapPosts(s.chapters, (p) => (p.id === post.id ? null : p)) }
          : s,
      );
    } catch (e) {
      Alert.alert(t('feed.deleteFailed'), errorMessage(e));
    }
  };

  const openExplore = () => void handleIntentChange('explore');

  /** Blocking is a safety action: their posts leave the screen right away. */
  const handleAuthorBlocked = (authorId: string) => {
    setSession((s) => {
      if (!s) return s;
      if (s.intent === 'explore') {
        return { ...s, people: s.people.filter((p) => p.id !== authorId) };
      }
      return { ...s, chapters: mapPosts(s.chapters, (p) => (p.user_id === authorId ? null : p)) };
    });
  };

  /** Opening someone's post is what counts as "seen" — never how long you look. */
  const handleOpenPerson = (personId: string) => {
    const current = sessionRef.current;
    if (!current || current.intent !== 'explore') return;
    const person = current.people.find((p) => p.id === personId);
    const post = person ? postForRound(person, current.round) : null;
    if (!post) return;
    setSession(markSeen(current, personId));
    decisionHaptic();
    router.push(`/explore/person/${personId}?postId=${post.id}`);
  };

  const handleNextRound = () => {
    setSession((s) => (s && s.intent === 'explore' ? nextRound(s) : s));
  };

  // Catch up and Mix can't be built without knowing who you follow. Never
  // fall back to "everyone": that would quietly undo the reader's choice.
  if (intent !== 'explore' && following === null && followError !== null) {
    return (
      <MessageState
        icon="cloud-offline-outline"
        title={t('feed.followLoadFailed')}
        detail={followError}
        actionTitle={t('common.retry')}
        onAction={() => void handleRefresh()}
      />
    );
  }

  if (session === null && initialError === null) {
    return <PostSkeletonList />;
  }

  if (session === null) {
    return (
      <MessageState
        icon="cloud-offline-outline"
        title={t('feed.loadFailed')}
        detail={initialError ?? undefined}
        actionTitle={t('common.retry')}
        onAction={() => void startSession(intent)}
      />
    );
  }

  if (session.intent === 'explore') {
    if (session.people.length === 0) {
      const othersCount = session.othersCount;
      return (
        <>
          <FeedIntentPicker value={intent} onChange={handleIntentChange} />
          {othersCount === 0 ? (
            <MessageState
              icon="newspaper-outline"
              title={t('feed.noOneElse.title')}
              detail={t('feed.noOneElse.detail')}
            />
          ) : othersCount !== null && othersCount <= (following?.size ?? 0) ? (
            <MessageState
              icon="checkmark-done-outline"
              title={t('feed.followEveryone.title')}
              detail={t('feed.followEveryone.detail')}
            />
          ) : (
            <MessageState
              icon="newspaper-outline"
              title={t('feed.nobodyOutside.title')}
              detail={t('feed.nobodyOutside.detail')}
              actionTitle={t('feed.checkAgain')}
              onAction={() => void handleRefresh()}
            />
          )}
        </>
      );
    }
    return (
      <>
        <FeedIntentPicker value={intent} onChange={handleIntentChange} />
        <Animated.View
          key={sessionKey}
          entering={FadeIn.duration(Motion.base)}
          style={styles.list}
        >
          <ExploreCanvas
            session={session}
            me={profile}
            insideIds={[...(sets?.following ?? [])]}
            onOpenPerson={handleOpenPerson}
            onNextRound={handleNextRound}
          />
        </Animated.View>
      </>
    );
  }

  const rows = toRows(
    session.chapters,
    session.notes,
    session.intent === 'mix_it_up' ? session.outsideIds : new Set<string>(),
    freshChapter,
  );
  const lastChapter = session.chapters[session.chapters.length - 1] ?? [];
  const lastChapterPeople = new Set(lastChapter.map((p) => p.user_id)).size;
  const isEmpty = rows.length === 0;
  const followingAnyone = (following?.size ?? 0) > 0;

  const emptyState = (() => {
    if (session.intent === 'catch_up') {
      return followingAnyone ? (
        <MessageState
          icon="time-outline"
          title={t('feed.nobodyFollowedPosted.title')}
          detail={t('feed.nobodyFollowedPosted.detail')}
          actionTitle={t('feed.explorePeople')}
          onAction={openExplore}
        />
      ) : (
        <MessageState
          icon="people-outline"
          title={t('feed.notFollowing.title')}
          detail={t('feed.notFollowing.detail')}
          actionTitle={t('feed.explorePeople')}
          onAction={openExplore}
        />
      );
    }
    // A Mix with nothing on either side.
    if (session.othersCount === 0) {
      return (
        <MessageState
          icon="newspaper-outline"
          title={t('feed.noOneElse.title')}
          detail={t('feed.noOneElse.detail')}
        />
      );
    }
    if (session.othersCount !== null && session.othersCount <= (following?.size ?? 0)) {
      return (
        <MessageState
          icon="checkmark-done-outline"
          title={t('feed.followEveryone.title')}
          detail={t('feed.followEveryone.detail')}
        />
      );
    }
    return (
      <MessageState
        icon="newspaper-outline"
        title={t('feed.nobodyOutside.title')}
        detail={t('feed.nobodyOutside.detail')}
      />
    );
  })();

  return (
    <Animated.View
      key={sessionKey}
      entering={FadeInUp.duration(Motion.base).withInitialValues({ transform: [{ translateY: 4 }] })}
      style={styles.list}
    >
    <PullFork progress={pull} refreshing={refreshing} color={colors.tint} />
    <Animated.FlatList
      style={[styles.list, { backgroundColor: colors.background }]}
      data={rows}
      onScroll={onScroll}
      scrollEventThrottle={16}
      keyExtractor={(row) => row.key}
      renderItem={({ item, index }) =>
        item.kind === 'divider' ? (
          <ChapterDivider
            chapter={item.chapter}
            note={item.note}
            fresh={item.chapter === freshChapter}
          />
        ) : item.fresh ? (
          <Animated.View
            entering={FadeInUp.duration(Motion.slow)
              .delay(Math.min(index - item.chapterStart, 6) * 40)
              .withInitialValues({ transform: [{ translateY: 6 }] })}
          >
            <PostCard
              post={item.post}
              isOwn={item.post.user_id === userId}
              onToggleLike={handleToggleLike}
              onOpenComments={(p) => router.push(`/post/${p.id}`)}
              onOpenAuthor={(uid) => router.push(`/user/${uid}`)}
              onAuthorBlocked={handleAuthorBlocked}
              onDelete={handleDelete}
              origin={item.outside ? 'beyond' : 'circle'}
            />
          </Animated.View>
        ) : (
          <PostCard
            post={item.post}
            isOwn={item.post.user_id === userId}
            onToggleLike={handleToggleLike}
            onOpenComments={(p) => router.push(`/post/${p.id}`)}
            onOpenAuthor={(uid) => router.push(`/user/${uid}`)}
            onAuthorBlocked={handleAuthorBlocked}
            onDelete={handleDelete}
            origin={item.outside ? 'beyond' : 'circle'}
          />
        )
      }
      ListHeaderComponent={<FeedIntentPicker value={intent} onChange={handleIntentChange} />}
      ListEmptyComponent={emptyState}
      ListFooterComponent={
        isEmpty ? null : sessionHasMore(session) ? (
          <ChapterEnd
            variant="chapter-end"
            chapter={session.chapters.length}
            postCount={lastChapter.length}
            peopleCount={lastChapterPeople}
            loading={loadingNext}
            error={nextError}
            onNext={handleNextChapter}
          />
        ) : (
          <ChapterEnd variant="caught-up" />
        )
      }
      contentContainerStyle={isEmpty ? styles.emptyGrow : undefined}
    />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  emptyGrow: {
    flexGrow: 1,
  },
});
