/**
 * Three words a reader can leave on a post. Fixed on purpose: no free text,
 * no emoji, no counts. Labels live in the dictionary under `reaction.<kind>`.
 */
export type ReactionKind = 'relate' | 'learned' | 'differs';

export const REACTION_KINDS: readonly ReactionKind[] = ['relate', 'learned', 'differs'];

export function isReactionKind(value: unknown): value is ReactionKind {
  return REACTION_KINDS.some((k) => k === value);
}
