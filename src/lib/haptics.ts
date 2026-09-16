import * as Haptics from 'expo-haptics';

/**
 * Diverge's one haptic: a light tap, felt only at the moment a decision is
 * made — following someone, publishing, opening a chapter, opening a
 * person. Never on likes, scrolling or navigation.
 */
export function decisionHaptic(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}
