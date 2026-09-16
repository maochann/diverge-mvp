import type { ExploreItem } from '@/services/posts';
import type { FeedPost, PostAuthor } from '@/types';

/**
 * An Explore session: a snapshot of everyone outside the reader's circle
 * who has posted, each with their posts in newest-first order, read in
 * rounds. Round 1 is everyone's newest post; round 2 only opens once every
 * available person in round 1 has been seen — and only if the reader asks.
 */

export interface CanvasPerson {
  id: string;
  author: PostAuthor;
  /** Posts newest first (rank 1, 2, …), as far as the snapshot fetched them. */
  posts: FeedPost[];
}

export interface ExploreSession {
  intent: 'explore';
  cutoff: string;
  round: number;
  people: CanvasPerson[];
  /** People whose current-round post has been opened. */
  seen: ReadonlySet<string>;
  /** Set when there was nobody to show, to choose the right empty state. */
  othersCount: number | null;
}

/** Group a flat, rank-ordered Explore page into people. */
export function peopleFromItems(items: readonly ExploreItem[]): CanvasPerson[] {
  const order: string[] = [];
  const byId = new Map<string, CanvasPerson>();
  for (const { post } of items) {
    let person = byId.get(post.user_id);
    if (!person) {
      person = { id: post.user_id, author: post.author, posts: [] };
      byId.set(post.user_id, person);
      order.push(post.user_id);
    }
    person.posts.push(post);
  }
  return order.map((id) => byId.get(id) as CanvasPerson);
}

/** The post a person shows in the given round, if they have one. */
export function postForRound(person: CanvasPerson, round: number): FeedPost | null {
  return person.posts[round - 1] ?? null;
}

/** People who have something to show this round. */
export function availableIn(session: ExploreSession): CanvasPerson[] {
  return session.people.filter((p) => postForRound(p, session.round) !== null);
}

export function unseenCount(session: ExploreSession): number {
  return availableIn(session).filter((p) => !session.seen.has(p.id)).length;
}

/** True once every available person this round has been opened. */
export function roundComplete(session: ExploreSession): boolean {
  const available = availableIn(session);
  return available.length > 0 && available.every((p) => session.seen.has(p.id));
}

/** True if at least one person has a post for the next round. */
export function hasNextRound(session: ExploreSession): boolean {
  return session.people.some((p) => postForRound(p, session.round + 1) !== null);
}

export function markSeen(session: ExploreSession, personId: string): ExploreSession {
  if (session.seen.has(personId)) return session;
  return { ...session, seen: new Set([...session.seen, personId]) };
}

export function nextRound(session: ExploreSession): ExploreSession {
  return { ...session, round: session.round + 1, seen: new Set() };
}
