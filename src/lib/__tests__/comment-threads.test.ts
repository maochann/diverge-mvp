import { describe, expect, it } from 'vitest';

import { buildThreads, composeReplyText, liveCount, replyTargetFor } from '@/lib/comment-threads';
import type { Comment } from '@/types';

function comment(
  id: string,
  at: string,
  parent: string | null = null,
  username = 'someone',
  deleted: string | null = null,
): Comment {
  return {
    id,
    post_id: 'post',
    user_id: `user-${username}`,
    content: `c${id}`,
    created_at: `2026-10-06T10:${at}:00Z`,
    parent_comment_id: parent,
    deleted_at: deleted,
    author: { username, display_name: username, avatar_url: null },
  };
}

describe('buildThreads', () => {
  it('puts replies under their root in time order', () => {
    const threads = buildThreads([
      comment('r2', '05', 'a'),
      comment('a', '01'),
      comment('b', '02'),
      comment('r1', '03', 'a'),
      comment('r3', '04', 'b'),
    ]);
    expect(threads.map((t) => t.root.id)).toEqual(['a', 'b']);
    expect(threads[0].replies.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(threads[1].replies.map((r) => r.id)).toEqual(['r3']);
  });

  it('drops replies whose root is hidden (blocked author)', () => {
    const threads = buildThreads([comment('a', '01'), comment('orphan', '02', 'hidden-root')]);
    expect(threads).toHaveLength(1);
    expect(threads[0].replies).toHaveLength(0);
  });

  it('keeps a tombstone root so its replies stay in place', () => {
    const threads = buildThreads([
      comment('a', '01', null, 'gone', '2026-10-06T11:00:00Z'),
      comment('r1', '02', 'a'),
    ]);
    expect(threads[0].root.deleted_at).not.toBeNull();
    expect(threads[0].replies.map((r) => r.id)).toEqual(['r1']);
    expect(liveCount([threads[0].root, ...threads[0].replies])).toBe(1);
  });
});

describe('reply targets', () => {
  it('replies to a root land under that root', () => {
    const target = replyTargetFor(comment('a', '01', null, 'mao'));
    expect(target).toEqual({ rootId: 'a', username: 'mao', toReply: false });
    expect(composeReplyText('  hello  ', target)).toBe('hello');
  });

  it('replies to a reply flatten to the root and address the person', () => {
    const target = replyTargetFor(comment('r1', '02', 'a', 'sota'));
    expect(target).toEqual({ rootId: 'a', username: 'sota', toReply: true });
    expect(composeReplyText('same here', target)).toBe('@sota same here');
    expect(composeReplyText('@sota already typed', target)).toBe('@sota already typed');
  });
});
