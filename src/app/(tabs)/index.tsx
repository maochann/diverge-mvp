import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, StyleSheet } from 'react-native';

import { ChapterDivider } from '@/components/chapter-divider';
import { ChapterEnd } from '@/components/chapter-end';
import { FeedIntentPicker } from '@/components/feed-intent-picker';
import { MessageState } from '@/components/message-state';
import { PostCard } from '@/components/post-card';
import { PostSkeletonList } from '@/components/post-skeleton';
import { CHAPTER_SIZE, type FeedIntent } from '@/constants/feed';
import { useFeedIntent } from '@/lib/feed-intent';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import {
  deletePost,
  fetchFeedChapter,
  fetchPostsByIds,
  setLiked,
  type FeedCursor,
} from '@/services/posts';
import type { FeedPost } from '@/types';

/**
 * One reading session: the chapters seen so far and where the next one
 * starts. Lives only in memory — pull-to-refresh, logout or an app restart
 * begin a new session from the newest posts.
 */
interface FeedSession {
  chapters: FeedPost[][];
  cursor: FeedCursor | null;
  hasMore: boolean;
}

type Row =
  | { kind: 'post'; key: string; post: FeedPost }
  | { kind: 'divider'; key: string; chapter: number };

function toRows(chapters: FeedPost[][]): Row[] {
  const rows: Row[] = [];
  chapters.forEach((chapter, index) => {
    if (index > 0) rows.push({ kind: 'divider', key: `chapter-${index + 1}`, chapter: index + 1 });
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

export default function FeedScreen() {
  const { session: auth } = useAuth();
  const { colors } = useTheme();
  const userId = auth?.user.id ?? '';
  const { intent, setIntent, ready: intentReady } = useFeedIntent(userId);

  const [session, setSession] = useState<FeedSession | null>(null);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [nextError, setNextError] = useState<string | null>(null);
  const [loadingNext, setLoadingNext] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Latest session for callbacks that must not re-subscribe on every change
  // (the focus effect in particular).
  const sessionRef = useRef<FeedSession | null>(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  /** Start (or restart) a session from the newest posts. */
  const startSession = useCallback(async (forIntent: FeedIntent) => {
    try {
      setInitialError(null);
      const chapter = await fetchFeedChapter(userId, { intent: forIntent, limit: CHAPTER_SIZE });
      setSession({
        chapters: [chapter.posts],
        cursor: chapter.nextCursor,
        hasMore: chapter.hasMore,
      });
      setNextError(null);
    } catch (e) {
      setInitialError(errorMessage(e));
    }
  }, [userId]);

  /**
   * Bring like/comment counts up to date for posts already on screen without
   * changing which posts are shown. Posts deleted elsewhere drop out.
   */
  const refreshCounts = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;
    const ids = current.chapters.flat().map((p) => p.id);
    try {
      const fresh = new Map((await fetchPostsByIds(ids, userId)).map((p) => [p.id, p]));
      setSession((s) =>
        s ? { ...s, chapters: mapPosts(s.chapters, (p) => fresh.get(p.id) ?? null) } : s,
      );
    } catch {
      // Counts are best-effort; the chapter itself is still valid.
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      if (!intentReady) return;
      if (sessionRef.current === null) {
        void startSession(intent);
      } else {
        void refreshCounts();
      }
      // `intent` is read once here on purpose: changing it goes through
      // handleIntentChange, which restarts the session itself.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [intentReady, startSession, refreshCounts]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await startSession(intent);
    setRefreshing(false);
  };

  /** A new intent is a new reading session: back to the top, chapter one. */
  const handleIntentChange = async (next: FeedIntent) => {
    if (next === intent) return;
    setIntent(next);
    setSession(null);
    await startSession(next);
  };

  const handleNextChapter = async () => {
    const current = session;
    if (!current || !current.hasMore || loadingNext) return;
    setLoadingNext(true);
    setNextError(null);
    try {
      const chapter = await fetchFeedChapter(userId, {
        intent,
        before: current.cursor,
        limit: CHAPTER_SIZE,
      });
      // Belt and braces: the cursor already guarantees no repeats.
      const seen = new Set(current.chapters.flat().map((p) => p.id));
      const posts = chapter.posts.filter((p) => !seen.has(p.id));
      setSession((s) =>
        s
          ? {
              chapters: posts.length > 0 ? [...s.chapters, posts] : s.chapters,
              cursor: chapter.nextCursor ?? s.cursor,
              hasMore: chapter.hasMore,
            }
          : s,
      );
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

  const rows = toRows(session.chapters);
  const lastChapter = session.chapters[session.chapters.length - 1] ?? [];
  const isEmpty = rows.length === 0;

  return (
    <FlatList
      style={[styles.list, { backgroundColor: colors.background }]}
      data={rows}
      keyExtractor={(row) => row.key}
      renderItem={({ item }) =>
        item.kind === 'divider' ? (
          <ChapterDivider chapter={item.chapter} />
        ) : (
          <PostCard
            post={item.post}
            isOwn={item.post.user_id === userId}
            onToggleLike={handleToggleLike}
            onOpenComments={(p) => router.push(`/post/${p.id}`)}
            onDelete={handleDelete}
          />
        )
      }
      refreshing={refreshing}
      onRefresh={handleRefresh}
      ListHeaderComponent={<FeedIntentPicker value={intent} onChange={handleIntentChange} />}
      ListEmptyComponent={
        <MessageState
          icon="newspaper-outline"
          title="No posts yet"
          detail="Be the first to say something."
          actionTitle="Create a post"
          onAction={() => router.navigate('/create')}
        />
      }
      ListFooterComponent={
        isEmpty ? null : session.hasMore ? (
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
