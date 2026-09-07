import { StyleSheet, Text, View } from 'react-native';

import { Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/lib/theme';

/** Quiet boundary between chapters once the reader has asked for another. */
export function ChapterDivider({ chapter }: { chapter: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="header">
      <View style={[styles.line, { backgroundColor: colors.border }]} />
      <Text style={[styles.label, { color: colors.textTertiary }]}>Chapter {chapter}</Text>
      <View style={[styles.line, { backgroundColor: colors.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  label: Type.caption,
});
