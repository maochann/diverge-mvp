import { StyleSheet, Text, View } from 'react-native';

import { Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/lib/theme';

interface ChapterDividerProps {
  chapter: number;
  /** Optional one-line note about how this chapter was put together. */
  note?: string | null;
}

/**
 * The start of a chapter: a serif marker with room around it. The first
 * chapter also uses this, so the feed reads like a book from the top.
 */
export function ChapterDivider({ chapter, note }: ChapterDividerProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.block} accessibilityRole="header">
      <Text style={[styles.label, { color: colors.textSecondary }]}>Chapter {chapter}</Text>
      {note ? <Text style={[styles.note, { color: colors.textTertiary }]}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  label: Type.chapter,
  note: Type.caption,
});
