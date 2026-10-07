import type { Comment } from '@/types';

/**
 * One root comment and the replies under it, each in the order written.
 * Threads are one level deep by design: replying to a reply still lands
 * under the same root (the composer says who is being answered).
 */
export interface CommentThread {
  root: Comment;
  replies: Comment[];
}

/**
 * Group a post's comments into threads. A reply whose root is not in the
 * list (its author is blocked either way, so the database hid it) is
 * dropped: a reply cannot stand without the comment it answers.
 */
export function buildThreads(comments: readonly Comment[]): CommentThread[] {
  const byTime = [...comments].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const threads = new Map<string, CommentThread>();
  for (const c of byTime) {
    if (c.parent_comment_id === null) threads.set(c.id, { root: c, replies: [] });
  }
  for (const c of byTime) {
    if (c.parent_comment_id === null) continue;
    threads.get(c.parent_comment_id)?.replies.push(c);
  }
  return [...threads.values()];
}

/** Comments that still count: tombstones are placeholders, not comments. */
export function liveCount(comments: readonly Comment[]): number {
  return comments.filter((c) => c.deleted_at === null).length;
}

export interface ReplyTarget {
  /** The root comment the reply will be stored under. */
  rootId: string;
  /** Who is being answered: the root's author, or a reply's author. */
  username: string;
  /** True when answering a reply rather than the root (the text is addressed). */
  toReply: boolean;
}

/**
 * Where a reply to `comment` goes. Replying to a reply flattens to the
 * reply's root; the addressee is still the person tapped.
 */
export function replyTargetFor(comment: Comment): ReplyTarget {
  return {
    rootId: comment.parent_comment_id ?? comment.id,
    username: comment.author.username,
    toReply: comment.parent_comment_id !== null,
  };
}

/**
 * The text actually sent: answering a reply prefixes the addressee so the
 * thread reads correctly under the root. Answering the root sends as-is.
 */
export function composeReplyText(draft: string, target: ReplyTarget): string {
  const text = draft.trim();
  if (!target.toReply) return text;
  const mention = `@${target.username}`;
  return text.startsWith(mention) ? text : `${mention} ${text}`;
}
