import type { FeedIntent } from '@/constants/feed';
import { supabase } from '@/lib/supabase';
import type { Comment, FeedPost, PostAuthor } from '@/types';

const POST_FIELDS = `
  id, user_id, content, image_url, created_at,
  author:profiles!posts_user_id_fkey ( username, display_name, avatar_url ),
  likes ( user_id ),
  comments ( count )
`;

interface PostRow {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  author: PostAuthor;
  likes: { user_id: string }[];
  comments: { count: number }[];
}

function toFeedPost(row: PostRow, viewerId: string): FeedPost {
  return {
    id: row.id,
    user_id: row.user_id,
    content: row.content,
    image_url: row.image_url,
    created_at: row.created_at,
    author: row.author,
    like_count: row.likes.length,
    comment_count: row.comments[0]?.count ?? 0,
    liked_by_me: row.likes.some((l) => l.user_id === viewerId),
  };
}

/** Position in the chronological feed: the last post the reader has seen. */
export interface FeedCursor {
  created_at: string;
  id: string;
}

export interface FeedChapter {
  posts: FeedPost[];
  /** Whether at least one older post exists beyond this chapter. */
  hasMore: boolean;
  /** Cursor for the chapter after this one (null when there are no posts). */
  nextCursor: FeedCursor | null;
}

interface FetchChapterOptions {
  /**
   * What the reader asked for. Accepted now so the call sites are already
   * wired; every intent currently returns the plain chronological feed.
   */
  intent: FeedIntent;
  /** Only posts strictly older than this cursor. Omit for the newest chapter. */
  before?: FeedCursor | null;
  limit: number;
}

/**
 * One chapter of the feed: all users' posts, newest first, no ranking.
 * Keyset pagination on (created_at, id) so new or deleted posts never shift
 * the pages and a post can't appear in two chapters. Fetches one extra row
 * to learn whether more exist without a second query.
 */
export async function fetchFeedChapter(
  viewerId: string,
  { before, limit }: FetchChapterOptions,
): Promise<FeedChapter> {
  // `intent` is intentionally unused until ranking exists; see FetchChapterOptions.
  let query = supabase
    .from('posts')
    .select(POST_FIELDS)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (before) {
    // (created_at, id) < (cursor.created_at, cursor.id), spelled out for PostgREST.
    query = query.or(
      `created_at.lt."${before.created_at}",` +
        `and(created_at.eq."${before.created_at}",id.lt."${before.id}")`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = data as unknown as PostRow[];
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    posts: page.map((row) => toFeedPost(row, viewerId)),
    hasMore: rows.length > limit,
    nextCursor: last ? { created_at: last.created_at, id: last.id } : null,
  };
}

/**
 * Re-read specific posts (e.g. after returning from a post's detail screen)
 * so like/comment counts stay current without re-fetching the feed.
 * Posts that no longer exist are simply absent from the result.
 */
export async function fetchPostsByIds(
  ids: string[],
  viewerId: string,
): Promise<FeedPost[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('posts')
    .select(POST_FIELDS)
    .in('id', ids);
  if (error) throw new Error(error.message);
  return (data as unknown as PostRow[]).map((row) => toFeedPost(row, viewerId));
}

/** One user's posts, newest first. Used for the "my posts" list on the profile. */
export async function fetchUserPosts(
  authorId: string,
  viewerId: string,
): Promise<FeedPost[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_FIELDS)
    .eq('user_id', authorId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as unknown as PostRow[]).map((row) => toFeedPost(row, viewerId));
}

export async function fetchPost(
  postId: string,
  viewerId: string,
): Promise<FeedPost> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_FIELDS)
    .eq('id', postId)
    .single();
  if (error) throw new Error(error.message);
  return toFeedPost(data as unknown as PostRow, viewerId);
}

export async function createPost(
  userId: string,
  content: string,
  imageUrl: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('posts')
    .insert({ user_id: userId, content: content.trim(), image_url: imageUrl });
  if (error) throw new Error(error.message);
}

export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', postId);
  if (error) throw new Error(error.message);
}

export async function setLiked(
  postId: string,
  userId: string,
  liked: boolean,
): Promise<void> {
  if (liked) {
    const { error } = await supabase
      .from('likes')
      // ignoreDuplicates makes a double-tap racing the server a no-op
      // (ON CONFLICT DO NOTHING) instead of an UPDATE that RLS blocks.
      .upsert(
        { post_id: postId, user_id: userId },
        { ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
  }
}

export async function fetchComments(postId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(
      `id, post_id, user_id, content, created_at,
       author:profiles!comments_user_id_fkey ( username, display_name, avatar_url )`,
    )
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data as unknown as Comment[];
}

export async function addComment(
  postId: string,
  userId: string,
  content: string,
): Promise<void> {
  const { error } = await supabase
    .from('comments')
    .insert({ post_id: postId, user_id: userId, content: content.trim() });
  if (error) throw new Error(error.message);
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  if (error) throw new Error(error.message);
}
