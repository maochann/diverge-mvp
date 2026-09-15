import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, StyleSheet } from 'react-native';

import { ChapterDivider } from '@/components/chapter-divider';
import { ChapterEnd } from '@/components/chapter-end';
import { ChapterNote } from '@/components/chapter-note';
import { FeedIntentPicker } from '@/components/feed-intent-picker';
import { MessageState } from '@/components/message-state';
import { PostCard } from '@/components/post-card';
import { PostSkeletonList } from '@/components/post-skeleton';
import { CHAPTER_SIZE, type FeedIntent } from '@/constants/feed';
import { useFeedIntent } from '@/lib/feed-intent';
import { composeMixChapter } from '@/lib/feed-mix';
import { useAuth } from '@/lib/auth-context';
import { useFollows } from '@/lib/follow-context';
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

interface ExploreSession extends SessionBase {
  intent: 'explore';
  cursor: ExploreCursor | null;
  hasMore: boolean;
}

interface MixSession extends SessionBase {
  intent: 'mix_it_up';
  followed: { cursor: FeedCursor | null; hasMore: boolean };
  outside: { cursor: ExploreCursor | null; hasMore: boolean };
}

type FeedSession = CatchUpSession | ExploreSession | MixSession;

function sessionHasMore(s: FeedSession): boolean {
  return s.intent === 'mix_it_up' ? s.followed.hasMore || s.outside.hasMore : s.hasMore;
}

type Row =
  | { kind: 'post'; key: string; post: FeedPost }
  | { kind: 'divider'; key: string; chapter: number }
  | { kind: 'note'; key: string; text: string };

function toRows(chapters: FeedPost[][], notes: (string | null)[]): Row[] {
  const rows: Row[] = [];
  chapters.forEach((chapter, index) => {
    if (index > 0) rows.push({ kind: 'divider', key: `chapter-${index + 1}`, chapter: index + 1 });
    const note = notes[index];
    if (note) rows.push({ kind: 'note', key: `note-${index + 1}`, text: note });
    for (const post of chapter) rows.push({ kind: 'post', key: post.id, post });
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
function mixNote(followedCount: number, outsideCount: number, followingAnyone: boolean) {
  if (followedCount + outsideCount === 0) return null;
  if (followedCount === 0) {
    return followingAnyone
      ? 'Nobody you follow has posted yet, so this chapter is all from outside your circle.'
      : "You're not following anyone yet, so this chapter is all from outside your circle.";
  }
  if (outsideCount === 0) {
    return 'You follow everyone who has posted, so this chapter is all from your circle.';
  }
  return null;
}

export default function FeedScreen() {
  const { session: auth } = useAuth();
  const { colors } = useTheme();
  const userId = auth?.user.id ?? '';
  const { intent, setIntent, ready: intentReady } = useFeedIntent(userId);
  const { following, loadError: followError, reload: reloadFollows } = useFollows();

  const [session, setSession] = useState<FeedSession | null>(null);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [nextError, setNextError] = useState<string | null>(null);
  const [loadingNext, setLoadingNext] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Latest values for callbacks that must not re-subscribe on every change
  // (the focus effect in particular).
  const sessionRef = useRef<FeedSession | null>(null);
  const followingRef = useRef<ReadonlySet<string> | null>(null);
  const starting = useRef(false);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    followingRef.current = following;
  }, [following]);

  /** Start (or restart) a session from the newest posts. */
  const startSession = useCallback(
    async (forIntent: FeedIntent, ids: ReadonlySet<string> | null = followingRef.current) => {
      if (starting.current) return;
      starting.current = true;
      try {
        setInitialError(null);
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
          const chapter = await fetchExploreChapter(userId, { cutoff, limit: CHAPTER_SIZE });
          const posts = chapter.items.map((i) => i.post);
          setSession({
            intent: 'explore',
            chapters: [posts],
            notes: [null],
            cutoff: chapter.cutoff,
            cursor: chapter.nextCursor,
            hasMore: chapter.hasMore,
            othersCount: posts.length === 0 ? await countOtherProfiles(userId) : null,
          });
        } else {
          const [followed, outside] = await Promise.all([
            fetchFollowedChapter(userId, { authorIds, cutoff, limit: CHAPTER_SIZE }),
            fetchExploreChapter(userId, { cutoff, limit: CHAPTER_SIZE }),
          ]);
          const mix = composeMixChapter(followed.posts, outside.items);
          const posts = mix.items.map((i) => (i.kind === 'followed' ? i.item : i.item.post));
          const lastF = followed.posts[mix.usedFollowed - 1];
          const lastO = outside.items[mix.usedOutside - 1];
          setSession({
            intent: 'mix_it_up',
            chapters: [posts],
            notes: [mixNote(mix.usedFollowed, mix.usedOutside, authorIds.length > 0)],
            cutoff: outside.cutoff,
            followed: {
              cursor: lastF ? { created_at: lastF.created_at, id: lastF.id } : null,
              hasMore: followed.hasMore || followed.posts.length > mix.usedFollowed,
            },
            outside: {
              cursor: lastO ? lastO.cursor : null,
              hasMore: outside.hasMore || outside.items.length > mix.usedOutside,
            },
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
    [userId],
  );

  /**
   * Bring like/comment counts up to date for posts already on screen without
   * changing which posts are shown. Posts deleted elsewhere drop out.
   */
  const refreshCounts = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;
    const ids = current.chapters.flat().map((p) => p.id);
    if (ids.length === 0) return;
    try {
      const fresh = new Map((await fetchPostsByIds(ids, userId)).map((p) => [p.id, p]));
      setSession((s) =>
        s ? { ...s, chapters: mapPosts(s.chapters, (p) => fresh.get(p.id) ?? null) } : s,
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
    setRefreshing(true);
    // Who you follow may have changed elsewhere; the new session should know.
    const ids = await reloadFollows();
    if (intent === 'explore' || ids !== null) await startSession(intent, ids);
    setRefreshing(false);
  };

  /** A new intent is a new reading session: back to the top, chapter one. */
  const handleIntentChange = async (next: FeedIntent) => {
    if (next === intent) return;
    setIntent(next);
    setSession(null);
    if (next === 'explore' || followingRef.current !== null) await startSession(next);
  };

  const handleNextChapter = async () => {
    const current = session;
    if (!current || !sessionHasMore(current) || loadingNext) return;
    setLoadingNext(true);
    setNextError(null);
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
      } else if (current.intent === 'explore') {
        const chapter = await fetchExploreChapter(userId, {
          cutoff: current.cutoff,
          after: current.cursor,
          limit: CHAPTER_SIZE,
        });
        const posts = chapter.items.map((i) => i.post).filter((p) => !seen.has(p.id));
        setSession((s) =>
          s && s.intent === 'explore'
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
        const mix = composeMixChapter(
          followed.posts.filter((p) => !seen.has(p.id)),
          outside.items.filter((i) => !seen.has(i.post.id)),
        );
        const posts = mix.items.map((i) => (i.kind === 'followed' ? i.item : i.item.post));
        const usedF = mix.items.filter((i) => i.kind === 'followed');
        const usedO = mix.items.filter((i) => i.kind === 'outside');
        const lastF = usedF[usedF.length - 1];
        const lastO = usedO[usedO.length - 1];
        setSession((s) =>
          s && s.intent === 'mix_it_up'
            ? {
                ...s,
                chapters: posts.length > 0 ? [...s.chapters, posts] : s.chapters,
                notes:
                  posts.length > 0
                    ? [...s.notes, mixNote(mix.usedFollowed, mix.usedOutside, authorIds.length > 0)]
                    : s.notes,
                followed: {
                  cursor:
                    lastF && lastF.kind === 'followed'
                      ? { created_at: lastF.item.created_at, id: lastF.item.id }
                      : s.followed.cursor,
                  hasMore: followed.hasMore || followed.posts.length > mix.usedFollowed,
                },
                outside: {
                  cursor:
                    lastO && lastO.kind === 'outside' ? lastO.item.cursor : s.outside.cursor,
                  hasMore: outside.hasMore || outside.items.length > mix.usedOutside,
                },
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
      s ? { ...s, chapters: mapPosts(s.chapters, (p) => (p.id === post.id ? patched : p)) } : s,
    );
    try {
      await setLiked(post.id, userId, nextLiked);
    } catch (e) {
      setSession((s) =>
        s ? { ...s, chapters: mapPosts(s.chapters, (p) => (p.id === post.id ? post : p)) } : s,
      );
      Alert.alert('Could not update like', errorMessage(e));
    }
  };

  const handleDelete = async (post: FeedPost) => {
    try {
      await deletePost(post.id);
      setSession((s) =>
        s ? { ...s, chapters: mapPosts(s.chapters, (p) => (p.id === post.id ? null : p)) } : s,
      );
    } catch (e) {
      Alert.alert('Could not delete post', errorMessage(e));
    }
  };

  const openExplore = () => void handleIntentChange('explore');

  // Catch up and Mix can't be built without knowing who you follow. Never
  // fall back to "everyone": that would quietly undo the reader's choice.
  if (intent !== 'explore' && following === null && followError !== null) {
    return (
      <MessageState
        icon="cloud-offline-outline"
        title="Couldn't load who you follow"
        detail={followError}
        actionTitle="Retry"
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
        title="Couldn't load the feed"
        detail={initialError ?? undefined}
        actionTitle="Retry"
        onAction={() => void startSession(intent)}
      />
    );
  }

  const rows = toRows(session.chapters, session.notes);
  const lastChapter = session.chapters[session.chapters.length - 1] ?? [];
  const isEmpty = rows.length === 0;
  const followingAnyone = (following?.size ?? 0) > 0;

  const emptyState = (() => {
    if (session.intent === 'catch_up') {
      return followingAnyone ? (
        <MessageState
          icon="time-outline"
          title="Nobody you follow has posted yet"
          detail="Their posts will show up here when they do."
          actionTitle="Explore people"
          onAction={openExplore}
        />
      ) : (
        <MessageState
          icon="people-outline"
          title="You're not following anyone yet"
          detail="Catch up shows posts from the people you choose to follow."
          actionTitle="Explore people"
          onAction={openExplore}
        />
      );
    }
    // Explore, or a Mix with nothing on either side.
    if (session.othersCount === 0) {
      return (
        <MessageState
          icon="newspaper-outline"
          title="No one else is here yet"
          detail="When other people join and post, you'll find them here."
        />
      );
    }
    if (session.othersCount !== null && session.othersCount <= (following?.size ?? 0)) {
      return (
        <MessageState
          icon="checkmark-done-outline"
          title="You follow everyone here"
          detail="There's no one outside your circle right now."
        />
      );
    }
    return (
      <MessageState
        icon="newspaper-outline"
        title="Nobody outside your circle has posted yet"
        detail="Pull down to check again later."
      />
    );
  })();

  return (
    <FlatList
      style={[styles.list, { backgroundColor: colors.background }]}
      data={rows}
      keyExtractor={(row) => row.key}
      renderItem={({ item }) =>
        item.kind === 'divider' ? (
          <ChapterDivider chapter={item.chapter} />
        ) : item.kind === 'note' ? (
          <ChapterNote text={item.text} />
        ) : (
          <PostCard
            post={item.post}
            isOwn={item.post.user_id === userId}
            onToggleLike={handleToggleLike}
            onOpenComments={(p) => router.push(`/post/${p.id}`)}
            onOpenAuthor={(uid) => router.push(`/user/${uid}`)}
            onDelete={handleDelete}
          />
        )
      }
      refreshing={refreshing}
      onRefresh={handleRefresh}
      ListHeaderComponent={<FeedIntentPicker value={intent} onChange={handleIntentChange} />}
      ListEmptyComponent={emptyState}
      ListFooterComponent={
        isEmpty ? null : sessionHasMore(session) ? (
          <ChapterEnd
            variant="chapter-end"
            postCount={lastChapter.length}
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
