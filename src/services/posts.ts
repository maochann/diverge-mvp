import { supabase } from '@/lib/supabase';
import type { Comment, FeedPost, PostAuthor } from '@/types';

const POST_FIELDS = `
  id, user_id, content, image_url, image_urls, created_at,
  author:profiles!posts_user_id_fkey ( username, display_name, avatar_url ),
  likes ( user_id ),
  comments ( count )
`;

interface PostRow {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  image_urls: string[] | null;
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
    // Posts from before multi-photo have only image_url.
    image_urls:
      row.image_urls && row.image_urls.length > 0
        ? row.image_urls
        : row.image_url
          ? [row.image_url]
          : [],
    created_at: row.created_at,
    author: row.author,
    like_count: row.likes.length,
    comment_count: row.comments[0]?.count ?? 0,
    liked_by_me: row.likes.some((l) => l.user_id === viewerId),
  };
}

/** Position in a chronological feed: the last post the reader has seen. */
export interface FeedCursor {
  created_at: string;
  id: string;
}

export interface FeedChapter {
  posts: FeedPost[];
  /** Whether at least one more post exists beyond this chapter. */
  hasMore: boolean;
  /** Cursor for the chapter after this one (null when there are no posts). */
  nextCursor: FeedCursor | null;
}

interface FetchFollowedChapterOptions {
  /** Whose posts to read: the people the reader follows. Own posts are not in here. */
  authorIds: readonly string[];
  /**
   * Session snapshot: posts created after this moment are left for the next
   * session, so a chapter never changes under the reader.
   */
  cutoff: string;
  /** Only posts strictly older than this cursor. Omit for the newest chapter. */
  before?: FeedCursor | null;
  limit: number;
}

/**
 * One chapter of posts from a fixed set of people, newest first, no ranking.
 * Keyset pagination on (created_at, id) so new or deleted posts never shift
 * the pages and a post can't appear in two chapters. Fetches one extra row
 * to learn whether more exist without a second query.
 */
export async function fetchFollowedChapter(
  viewerId: string,
  { authorIds, cutoff, before, limit }: FetchFollowedChapterOptions,
): Promise<FeedChapter> {
  // Nobody to read from: don't ask the database (an empty `in ()` is an error).
  if (authorIds.length === 0) return { posts: [], hasMore: false, nextCursor: null };

  let query = supabase
    .from('posts')
    .select(POST_FIELDS)
    .in('user_id', [...authorIds])
    .lte('created_at', cutoff)
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
 * Position in the Explore ordering: (rank, created_at, id), where rank is
 * "which of this person's posts" (1 = newest). Everyone's rank-1 post comes
 * before anyone's rank-2 post.
 */
export interface ExploreCursor {
  rank: number;
  created_at: string;
  id: string;
}

export interface ExploreItem {
  post: FeedPost;
  /** Where this post sits in the Explore order; use as `after` to continue past it. */
  cursor: ExploreCursor;
}

export interface ExploreChapter {
  items: ExploreItem[];
  hasMore: boolean;
  /** Cursor past the whole page (including posts that were deleted meanwhile). */
  nextCursor: ExploreCursor | null;
  /** The effective session cutoff, clamped by the server; reuse for later chapters. */
  cutoff: string;
}

interface FetchExploreChapterOptions {
  cutoff: string;
  after?: ExploreCursor | null;
  limit: number;
}

interface ExploreRow {
  post_id: string;
  rank: number;
  created_at: string;
  cutoff: string;
}

/**
 * One chapter of posts from people the reader does not follow, ordered so
 * that every eligible person appears once before anyone appears twice. The
 * ordering lives in the `explore_chapter` database function; this fetches the
 * ordered ids, then hydrates them with the usual post fields.
 */
export async function fetchExploreChapter(
  viewerId: string,
  { cutoff, after, limit }: FetchExploreChapterOptions,
): Promise<ExploreChapter> {
  const { data, error } = await supabase.rpc('explore_chapter', {
    p_cutoff: cutoff,
    p_limit: limit + 1,
    p_after_rank: after?.rank ?? null,
    p_after_created_at: after?.created_at ?? null,
    p_after_id: after?.id ?? null,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as ExploreRow[];
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];

  const hydrated = new Map(
    (await fetchPostsByIds(page.map((r) => r.post_id), viewerId)).map((p) => [p.id, p]),
  );
  // Keep the function's order; posts deleted in between simply drop out.
  const items = page.flatMap((r) => {
    const post = hydrated.get(r.post_id);
    return post
      ? [{ post, cursor: { rank: r.rank, created_at: r.created_at, id: r.post_id } }]
      : [];
  });

  return {
    items,
    hasMore: rows.length > limit,
    nextCursor: last ? { rank: last.rank, created_at: last.created_at, id: last.post_id } : null,
    cutoff: rows[0]?.cutoff ?? cutoff,
  };
}

/** How many people (other than the viewer) exist at all. */
export async function countOtherProfiles(viewerId: string): Promise<number> {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .neq('id', viewerId);
  if (error) throw new Error(error.message);
  return count ?? 0;
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

/** Creates the post and returns its id so the caller can open it. */
export async function createPost(
  userId: string,
  content: string,
  imageUrls: string[],
): Promise<string> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      content: content.trim(),
      image_url: imageUrls[0] ?? null,
      image_urls: imageUrls,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
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
