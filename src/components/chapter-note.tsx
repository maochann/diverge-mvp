import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/lib/theme';

/**
 * One quiet line above a chapter saying how it was put together, shown only
 * when the composition isn't what the intent's name promises (e.g. Mix it up
 * with nobody followed yet). Information, not a prompt.
 */
export function ChapterNote({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.surface }]}>
      <Ionicons name="information-circle-outline" size={16} color={colors.textTertiary} />
      <Text style={[styles.text, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: 10,
  },
  text: {
    ...Type.caption,
    flex: 1,
  },
});
