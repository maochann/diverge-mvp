import type { AdjacentCandidate } from '@/lib/adjacent';
import { runPostQuery } from '@/services/posts';
import type { FeedPost } from '@/types';

/**
 * Raw adjacency candidates, straight from explicit relationships. Each
 * query is small and bounded; ranking (self, muted, outside-first, limits)
 * happens in `lib/adjacent.ts`. Blocked people never appear: the posts
 * SELECT policy hides them before any of this runs.
 */
const PER_SOURCE_LIMIT = 20;

/**
 * Neighbours of one post, for its detail screen:
 *  - other answers to the same daily prompt;
 *  - other branches from the same original (siblings);
 *  - branches from this post, and the original it branched from.
 */
export async function fetchAdjacentForPost(
  post: FeedPost,
  viewerId: string,
): Promise<AdjacentCandidate[]> {
  const jobs: Promise<AdjacentCandidate[]>[] = [];

  if (post.daily_prompt) {
    const promptId = post.daily_prompt.id;
    jobs.push(
      runPostQuery(viewerId, (q) =>
        q
          .eq('daily_prompt_id', promptId)
          .neq('id', post.id)
          .neq('user_id', post.user_id)
          .order('created_at', { ascending: false })
          .limit(PER_SOURCE_LIMIT),
      ).then((posts) => posts.map((p) => ({ post: p, reason: 'same_prompt' as const }))),
    );
  }

  if (post.forked_from_post_id) {
    const originId = post.forked_from_post_id;
    jobs.push(
      runPostQuery(viewerId, (q) =>
        q
          .eq('forked_from_post_id', originId)
          .neq('id', post.id)
          .order('created_at', { ascending: false })
          .limit(PER_SOURCE_LIMIT),
      ).then((posts) => posts.map((p) => ({ post: p, reason: 'same_origin' as const }))),
    );
    jobs.push(
      runPostQuery(viewerId, (q) => q.eq('id', originId).limit(1)).then((posts) =>
        posts.map((p) => ({ post: p, reason: 'sibling_branch' as const, direction: 'origin' as const })),
      ),
    );
  }

  jobs.push(
    runPostQuery(viewerId, (q) =>
      q.eq('forked_from_post_id', post.id).order('created_at', { ascending: false }).limit(PER_SOURCE_LIMIT),
    ).then((posts) =>
      posts.map((p) => ({ post: p, reason: 'sibling_branch' as const, direction: 'branch' as const })),
    ),
  );

  const results = await Promise.all(jobs);
  return results.flat();
}

/**
 * Outside voices related to a chapter of followed posts, for Mix it up:
 * answers to the same prompts, and branches from the same originals or from
 * the followed posts themselves. Only posts up to the session cutoff and by
 * people the reader does not follow (own posts and followed authors are
 * filtered here; muted and the final order are the ranker's job).
 */
export async function fetchAdjacentForChapter(
  followedPosts: readonly FeedPost[],
  viewerId: string,
  cutoff: string,
  excludeAuthorIds: ReadonlySet<string>,
): Promise<AdjacentCandidate[]> {
  if (followedPosts.length === 0) return [];
  const promptIds = [...new Set(followedPosts.flatMap((p) => (p.daily_prompt ? [p.daily_prompt.id] : [])))];
  const originIds = [
    ...new Set(followedPosts.flatMap((p) => (p.forked_from_post_id ? [p.forked_from_post_id] : []))),
  ];
  const followedIds = followedPosts.map((p) => p.id);
  const exclude = [viewerId, ...excludeAuthorIds];

  const jobs: Promise<AdjacentCandidate[]>[] = [];
  if (promptIds.length > 0) {
    jobs.push(
      runPostQuery(viewerId, (q) =>
        q
          .in('daily_prompt_id', promptIds)
          .not('user_id', 'in', `(${exclude.join(',')})`)
          .lte('created_at', cutoff)
          .order('created_at', { ascending: false })
          .limit(PER_SOURCE_LIMIT),
      ).then((posts) => posts.map((p) => ({ post: p, reason: 'same_prompt' as const }))),
    );
  }
  if (originIds.length > 0) {
    jobs.push(
      runPostQuery(viewerId, (q) =>
        q
          .in('forked_from_post_id', originIds)
          .not('user_id', 'in', `(${exclude.join(',')})`)
          .lte('created_at', cutoff)
          .order('created_at', { ascending: false })
          .limit(PER_SOURCE_LIMIT),
      ).then((posts) => posts.map((p) => ({ post: p, reason: 'same_origin' as const }))),
    );
  }
  jobs.push(
    runPostQuery(viewerId, (q) =>
      q
        .in('forked_from_post_id', followedIds)
        .not('user_id', 'in', `(${exclude.join(',')})`)
        .lte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(PER_SOURCE_LIMIT),
    ).then((posts) =>
      posts.map((p) => ({ post: p, reason: 'sibling_branch' as const, direction: 'branch' as const })),
    ),
  );

  const results = await Promise.all(jobs);
  return results.flat();
}
