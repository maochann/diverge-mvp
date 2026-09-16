import { useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/button';
import { ForkLine } from '@/components/fork-line';
import { Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/lib/theme';

type ChapterEndProps =
  | {
      /** More posts exist; the reader decides whether to see another chapter. */
      variant: 'chapter-end';
      chapter: number;
      postCount: number;
      peopleCount: number;
      loading: boolean;
      error: string | null;
      onNext: () => void;
    }
  | {
      /** The feed has no older posts. Nothing to load, nothing to press. */
      variant: 'caught-up';
    };

/**
 * The end of a chapter. Tall enough that no further post peeks in below it:
 * the feed stops here until the reader chooses otherwise. The fork marks
 * the one place the feed branches.
 */
/** A short rule that draws itself once: the quiet mark of an ending. */
function EndingRule({ color }: { color: string }) {
  const reducedMotion = useReducedMotion();
  const width = useSharedValue(reducedMotion ? 24 : 0);
  useEffect(() => {
    if (reducedMotion) return;
    width.set(withTiming(24, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, [reducedMotion, width]);
  const style = useAnimatedStyle(() => ({ width: width.value }));
  return <Animated.View style={[styles.shortRule, { backgroundColor: color }, style]} />;
}

export function ChapterEnd(props: ChapterEndProps) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const minHeight = Math.round(height * 0.55);

  if (props.variant === 'caught-up') {
    return (
      <View style={[styles.card, { minHeight }]}>
        <EndingRule color={colors.textTertiary} />
        <Text style={[styles.title, { color: colors.text }]}>You&apos;re caught up</Text>
        <Text style={[styles.detail, { color: colors.textSecondary }]}>
          Nothing new right now.
        </Text>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          Pull down to check for new posts.
        </Text>
      </View>
    );
  }

  const { chapter, postCount, peopleCount, loading, error, onNext } = props;
  return (
    <View style={[styles.card, { minHeight }]}>
      <View style={styles.forkRow}>
        <View style={[styles.rule, { backgroundColor: colors.border }]} />
        <ForkLine width={36} color={colors.textTertiary} />
        <View style={[styles.rule, { backgroundColor: colors.border }]} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>End of chapter {chapter}</Text>
      <Text style={[styles.detail, { color: colors.textSecondary }]}>
        {postCount} {postCount === 1 ? 'post' : 'posts'} · {peopleCount}{' '}
        {peopleCount === 1 ? 'person' : 'people'}
      </Text>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      <Button
        title={error ? 'Try again' : 'See another chapter'}
        variant="outline"
        compact
        loading={loading}
        onPress={onNext}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  forkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    alignSelf: 'stretch',
    marginBottom: Spacing.lg,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  shortRule: {
    height: 1,
    marginBottom: Spacing.lg,
  },
  title: {
    ...Type.display,
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  detail: {
    ...Type.body,
    textAlign: 'center',
  },
  hint: {
    ...Type.caption,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  error: {
    ...Type.caption,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  button: {
    marginTop: Spacing.lg,
  },
});
