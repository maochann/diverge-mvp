import { StyleSheet, Text, View } from 'react-native';

import { Spacing, Type } from '@/constants/theme';
import { useT } from '@/i18n';
import { useTheme } from '@/lib/theme';

/** Placeholder; replaced by the reminder settings screen in the notification step. */
export default function DailyPromptSettingsScreen() {
  const { colors } = useTheme();
  const t = useT();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text style={[styles.text, { color: colors.textSecondary }]}>{t('notify.toggleDetail')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: Spacing.lg },
  text: Type.body,
});
