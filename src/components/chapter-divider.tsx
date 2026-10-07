import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Motion, Spacing, Type } from '@/constants/theme';
import { useT } from '@/i18n';
import { useTheme } from '@/lib/theme';

interface ChapterDividerProps {
  chapter: number;
  /** Optional one-line note about how this chapter was put together. */
  note?: string | null;
  /** True when this chapter was just opened by the reader (animates in). */
  fresh?: boolean;
}

const RULE_WIDTH = 24;

/**
 * The start of a chapter: a serif marker with a short rule that draws
 * itself when the reader opens the chapter. Opening a chapter is the
 * reader's act, so the page should visibly turn.
 */
export function ChapterDivider({ chapter, note, fresh = false }: ChapterDividerProps) {
  const { colors } = useTheme();
  const t = useT();
  const reducedMotion = useReducedMotion();
  const rule = useSharedValue(fresh && !reducedMotion ? 0 : 1);
  const fade = useSharedValue(fresh && !reducedMotion ? 0 : 1);

  useEffect(() => {
    if (!fresh || reducedMotion) return;
    rule.set(withTiming(1, { duration: Motion.slow, easing: Easing.out(Easing.cubic) }));
    fade.set(withDelay(80, withTiming(1, { duration: Motion.base })));
  }, [fresh, reducedMotion, rule, fade]);

  const ruleStyle = useAnimatedStyle(() => ({
    width: RULE_WIDTH * rule.value,
  }));
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: (1 - fade.value) * 3 }],
  }));

  return (
    <View style={styles.block} accessibilityRole="header">
      <Animated.View style={[styles.rule, { backgroundColor: colors.textTertiary }, ruleStyle]} />
      <Animated.View style={fadeStyle}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('chapter.label', { n: chapter })}</Text>
        {note ? <Text style={[styles.note, { color: colors.textTertiary }]}>{note}</Text> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  rule: {
    height: 1,
  },
  label: Type.chapter,
  note: Type.caption,
});
