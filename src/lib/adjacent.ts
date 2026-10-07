import type { FeedPost } from '@/types';

/**
 * Adjacent Diversity, V1: "related enough to understand, different enough to
 * widen the view." Candidates come only from explicit, explainable
 * relationships — never from likes, follower counts, viewing time or any
 * other popularity signal — and every candidate carries the reason it is
 * here so the UI can say it plainly. No candidate means nothing is shown.
 */
export type AdjacentReason = 'same_prompt' | 'same_origin' | 'sibling_branch' | 'semantic_related';

/** For sibling_branch: which way the branch runs relative to the subject. */
export type BranchDirection = 'branch' | 'origin';

export interface AdjacentCandidate {
  post: FeedPost;
  reason: AdjacentReason;
  direction?: BranchDirection;
}

/** Lower is stronger. Priorities follow the explicit-signal hierarchy. */
const PRIORITY: Record<AdjacentReason, number> = {
  same_prompt: 1,
  same_origin: 2,
  sibling_branch: 3,
  semantic_related: 4,
};

export interface RankContext {
  viewerId: string;
  /** The post the candidates are adjacent to (never a candidate itself). */
  subjectId: string;
  following: ReadonlySet<string>;
  muted: ReadonlySet<string>;
  limit: number;
}

/** FNV-1a: a stable, popularity-free tiebreak so the same post shows the same neighbours. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * Order candidates and pick a few. Rules, in order:
 *  - never the reader's own post, the subject, or anyone the reader muted
 *    (blocked people never reach the client: the database hides them);
 *  - the strongest reason first;
 *  - someone the reader does not follow before someone they do
 *    ("outside preferred, followed allowed as fallback");
 *  - a stable hash as the tiebreak (no recency race, no popularity);
 *  - different authors across the slots when possible.
 * A post that qualifies for two reasons keeps the stronger one.
 */
export function rankAdjacent(
  candidates: readonly AdjacentCandidate[],
  ctx: RankContext,
): AdjacentCandidate[] {
  const best = new Map<string, AdjacentCandidate>();
  for (const c of candidates) {
    if (c.post.id === ctx.subjectId) continue;
    if (c.post.user_id === ctx.viewerId) continue;
    if (ctx.muted.has(c.post.user_id)) continue;
    const existing = best.get(c.post.id);
    if (!existing || PRIORITY[c.reason] < PRIORITY[existing.reason]) best.set(c.post.id, c);
  }

  const ordered = [...best.values()].sort((a, b) => {
    const p = PRIORITY[a.reason] - PRIORITY[b.reason];
    if (p !== 0) return p;
    const fa = ctx.following.has(a.post.user_id) ? 1 : 0;
    const fb = ctx.following.has(b.post.user_id) ? 1 : 0;
    if (fa !== fb) return fa - fb;
    return hash(ctx.subjectId + a.post.id) - hash(ctx.subjectId + b.post.id);
  });

  // First pass prefers distinct authors; second pass fills from the rest.
  const picked: AdjacentCandidate[] = [];
  const authors = new Set<string>();
  for (const c of ordered) {
    if (picked.length >= ctx.limit) break;
    if (authors.has(c.post.user_id)) continue;
    picked.push(c);
    authors.add(c.post.user_id);
  }
  for (const c of ordered) {
    if (picked.length >= ctx.limit) break;
    if (!picked.includes(c)) picked.push(c);
  }
  return picked;
}
