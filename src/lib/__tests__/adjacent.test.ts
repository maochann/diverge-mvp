import { describe, expect, it } from 'vitest';

import { rankAdjacent, type AdjacentCandidate } from '@/lib/adjacent';
import type { FeedPost } from '@/types';

function post(id: string, user: string, extra: Partial<FeedPost> = {}): FeedPost {
  return {
    id,
    user_id: user,
    content: id,
    image_url: null,
    image_urls: [],
    created_at: '2026-10-06T10:00:00Z',
    author: { username: user, display_name: user, avatar_url: null },
    like_count: 0,
    comment_count: 0,
    liked_by_me: false,
    forked_from_post_id: null,
    forked_from: null,
    branch_count: 0,
    daily_prompt: null,
    my_reaction: null,
    reactions: [],
    ...extra,
  };
}

const ctx = {
  viewerId: 'me',
  subjectId: 'subject',
  following: new Set(['friend']),
  muted: new Set(['muted']),
  limit: 2,
};

describe('rankAdjacent', () => {
  it('returns nothing when there are no candidates (never fakes adjacency)', () => {
    expect(rankAdjacent([], ctx)).toEqual([]);
  });

  it('excludes the reader, the subject and muted people', () => {
    const out = rankAdjacent(
      [
        { post: post('mine', 'me'), reason: 'same_prompt' },
        { post: post('subject', 'x'), reason: 'same_prompt' },
        { post: post('m1', 'muted'), reason: 'same_prompt' },
        { post: post('ok', 'stranger'), reason: 'same_prompt' },
      ],
      ctx,
    );
    expect(out.map((c) => c.post.id)).toEqual(['ok']);
  });

  it('prefers someone the reader does not follow, but falls back to a followed person', () => {
    const out = rankAdjacent(
      [
        { post: post('f', 'friend'), reason: 'same_prompt' },
        { post: post('s', 'stranger'), reason: 'same_prompt' },
      ],
      { ...ctx, limit: 1 },
    );
    expect(out[0].post.id).toBe('s');
    const fallback = rankAdjacent([{ post: post('f', 'friend'), reason: 'same_prompt' }], ctx);
    expect(fallback.map((c) => c.post.id)).toEqual(['f']);
  });

  it('orders by reason strength: same prompt, then same origin, then branches', () => {
    const out = rankAdjacent(
      [
        { post: post('b', 'a1'), reason: 'sibling_branch', direction: 'branch' },
        { post: post('o', 'a2'), reason: 'same_origin' },
        { post: post('p', 'a3'), reason: 'same_prompt' },
      ],
      { ...ctx, limit: 3 },
    );
    expect(out.map((c) => c.reason)).toEqual(['same_prompt', 'same_origin', 'sibling_branch']);
  });

  it('keeps the stronger reason when a post qualifies twice', () => {
    const out = rankAdjacent(
      [
        { post: post('x', 'a1'), reason: 'sibling_branch', direction: 'branch' },
        { post: post('x', 'a1'), reason: 'same_prompt' },
      ],
      ctx,
    );
    expect(out).toHaveLength(1);
    expect(out[0].reason).toBe('same_prompt');
  });

  it('spreads the slots across different authors when it can', () => {
    const out = rankAdjacent(
      [
        { post: post('a1-1', 'a1'), reason: 'same_prompt' },
        { post: post('a1-2', 'a1'), reason: 'same_prompt' },
        { post: post('a2-1', 'a2'), reason: 'same_prompt' },
      ],
      ctx,
    );
    expect(new Set(out.map((c) => c.post.user_id)).size).toBe(2);
  });

  it('ignores likes, comment counts and recency when ordering', () => {
    const popular = post('pop', 'a1', { like_count: 999, comment_count: 50, created_at: '2026-10-06T23:00:00Z' });
    const quiet = post('quiet', 'a2', { like_count: 0, comment_count: 0, created_at: '2026-01-01T00:00:00Z' });
    const candidates: AdjacentCandidate[] = [
      { post: popular, reason: 'same_prompt' },
      { post: quiet, reason: 'same_prompt' },
    ];
    const a = rankAdjacent(candidates, { ...ctx, limit: 1 });
    const b = rankAdjacent([...candidates].reverse(), { ...ctx, limit: 1 });
    // Deterministic and independent of input order and popularity data.
    expect(a[0].post.id).toBe(b[0].post.id);
    const swapped = rankAdjacent(
      [
        { post: { ...popular, like_count: 0 }, reason: 'same_prompt' },
        { post: { ...quiet, like_count: 999 }, reason: 'same_prompt' },
      ],
      { ...ctx, limit: 1 },
    );
    expect(swapped[0].post.id).toBe(a[0].post.id);
  });
});
