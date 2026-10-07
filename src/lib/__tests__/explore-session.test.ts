import { describe, expect, it } from 'vitest';

import {
  hasNextRound,
  markSeen,
  nextRound,
  peopleFromItems,
  postForRound,
  roundComplete,
  unseenCount,
  type ExploreSession,
} from '@/lib/explore-session';
import type { ExploreItem } from '@/services/posts';
import type { FeedPost } from '@/types';

function post(id: string, user: string): FeedPost {
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
  };
}

function item(id: string, user: string, rank: number): ExploreItem {
  return { post: post(id, user), cursor: { rank, created_at: '2026-10-06T10:00:00Z', id } };
}

describe('Explore session (regression)', () => {
  const items = [item('a1', 'a', 1), item('b1', 'b', 1), item('a2', 'a', 2)];
  const session: ExploreSession = {
    intent: 'explore',
    cutoff: '2026-10-06T12:00:00Z',
    round: 1,
    people: peopleFromItems(items),
    seen: new Set(),
    othersCount: null,
  };

  it('groups a rank-ordered page into people with their posts newest first', () => {
    expect(session.people.map((p) => p.id)).toEqual(['a', 'b']);
    expect(postForRound(session.people[0], 1)?.id).toBe('a1');
    expect(postForRound(session.people[0], 2)?.id).toBe('a2');
    expect(postForRound(session.people[1], 2)).toBeNull();
  });

  it('completes a round only when every available person has been opened', () => {
    expect(unseenCount(session)).toBe(2);
    expect(roundComplete(session)).toBe(false);
    const half = markSeen(session, 'a');
    expect(roundComplete(half)).toBe(false);
    const all = markSeen(half, 'b');
    expect(roundComplete(all)).toBe(true);
    expect(hasNextRound(all)).toBe(true);
    const second = nextRound(all);
    expect(second.round).toBe(2);
    expect(unseenCount(second)).toBe(1);
    expect(hasNextRound(second)).toBe(false);
  });
});
