import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Button } from '@/components/button';
import { Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/lib/theme';

type ChapterEndProps =
  | {
      /** More posts exist; the reader decides whether to see another chapter. */
      variant: 'chapter-end';
      postCount: number;
      loading: boolean;
      error: string | null;
      onNext: () => void;
    }
  | {
      /** The feed has no older posts. Nothing to load, nothing to press. */
      variant: 'caught-up';
    };

/**
 * Card at the bottom of the feed. Tall enough that no further post peeks in
 * below it: the feed stops here until the reader chooses otherwise.
 */
export function ChapterEnd(props: ChapterEndProps) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const minHeight = Math.round(height * 0.6);

  if (props.variant === 'caught-up') {
    return (
      <View style={[styles.card, { minHeight, borderTopColor: colors.border }]}>
        <Ionicons name="checkmark-circle-outline" size={36} color={colors.textTertiary} />
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

  const { postCount, loading, error, onNext } = props;
  return (
    <View style={[styles.card, { minHeight, borderTopColor: colors.border }]}>
      <Ionicons name="bookmark-outline" size={36} color={colors.textTertiary} />
      <Text style={[styles.title, { color: colors.text }]}>End of chapter</Text>
      <Text style={[styles.detail, { color: colors.textSecondary }]}>
        {postCount} {postCount === 1 ? 'post' : 'posts'}
      </Text>
      {error ? (
        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
      ) : null}
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
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  title: {
    ...Type.heading,
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
