import { CHAPTER_SIZE, MIX_FOLLOWED_COUNT, MIX_OUTSIDE_COUNT } from '@/constants/feed';

export interface MixComposition<F, O> {
  /** The chapter, in reading order. */
  items: ({ kind: 'followed'; item: F } | { kind: 'outside'; item: O })[];
  /** How many were taken from each pool (so cursors advance only past those). */
  usedFollowed: number;
  usedOutside: number;
}

/**
 * Build one Mix it up chapter from two pools that are each already in their
 * own order: mostly people the reader follows, with a few from outside.
 * The pattern is fixed (followed, followed, outside, …) rather than by time,
 * so the outside voices are spread through the chapter instead of clumped.
 * When one pool runs short the other fills in, up to CHAPTER_SIZE.
 */
export function composeMixChapter<F, O>(
  followed: readonly F[],
  outside: readonly O[],
): MixComposition<F, O> {
  let useOutside = Math.min(MIX_OUTSIDE_COUNT, outside.length);
  let useFollowed = Math.min(CHAPTER_SIZE - useOutside, followed.length);
  if (useFollowed < MIX_FOLLOWED_COUNT) {
    useOutside = Math.min(CHAPTER_SIZE - useFollowed, outside.length);
  }

  const items: MixComposition<F, O>['items'] = [];
  let f = 0;
  let o = 0;
  while (f < useFollowed || o < useOutside) {
    const outsideSlot = items.length % 3 === 2;
    if (outsideSlot && o < useOutside) {
      items.push({ kind: 'outside', item: outside[o++] });
    } else if (f < useFollowed) {
      items.push({ kind: 'followed', item: followed[f++] });
    } else {
      items.push({ kind: 'outside', item: outside[o++] });
    }
  }

  return { items, usedFollowed: useFollowed, usedOutside: useOutside };
}

/**
 * Where an outside post in a Mix chapter came from: an Adjacent candidate
 * (related by prompt or fork to a followed post in the chapter) or the
 * people-balanced Explore pool. Adjacent posts take the outside slots first;
 * the Explore pool fills whatever is left, so the fixed F F O pattern and
 * the Explore cursor both stay exactly as they were.
 */
export type OutsideSource<P, E> = { source: 'adjacent'; post: P } | { source: 'explore'; item: E };

export function mergeOutsidePool<P extends { id: string }, E extends { post: { id: string } }>(
  adjacent: readonly P[],
  explore: readonly E[],
  seen: ReadonlySet<string>,
): OutsideSource<P, E>[] {
  const taken = new Set<string>();
  const pool: OutsideSource<P, E>[] = [];
  for (const post of adjacent) {
    if (seen.has(post.id) || taken.has(post.id)) continue;
    taken.add(post.id);
    pool.push({ source: 'adjacent', post });
  }
  for (const item of explore) {
    if (seen.has(item.post.id) || taken.has(item.post.id)) continue;
    taken.add(item.post.id);
    pool.push({ source: 'explore', item });
  }
  return pool;
}
