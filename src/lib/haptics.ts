import * as Haptics from 'expo-haptics';

/**
 * Two haptics, both light.
 *
 * `decisionHaptic` is felt only at the moment a decision is made — following
 * someone, publishing, opening a chapter, opening a person. Never on likes
 * or scrolling.
 *
 * `selectionHaptic` is the system's "selection changed" tick, used when the
 * reader moves between the three tabs — the same feel as a picker wheel.
 */
export function decisionHaptic(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function selectionHaptic(): void {
  Haptics.selectionAsync().catch(() => undefined);
}

/**
 * A touch heavier than a decision: publishing a fork, where a thought is
 * taken somewhere new. Still a single, short impact.
 */
export function successHaptic(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}
