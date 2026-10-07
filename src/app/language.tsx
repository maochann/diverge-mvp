import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Spacing, Type } from '@/constants/theme';
import { useI18n, type LanguagePreference } from '@/i18n';
import { useTheme } from '@/lib/theme';

const OPTIONS: readonly LanguagePreference[] = ['system', 'en', 'ja'];

/**
 * Settings → Language. System follows the device; a choice is remembered on
 * this device and takes effect immediately. Only the app's own text changes:
 * posts and comments always stay as written.
 */
export default function LanguageScreen() {
  const { colors } = useTheme();
  const { t, preference, setPreference } = useI18n();

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.container}
    >
      <View accessibilityRole="radiogroup">
        {OPTIONS.map((option) => {
          const active = option === preference;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(`language.${option}`)}
              onPress={() => setPreference(option)}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.rowText}>
                <Text style={[styles.label, { color: colors.text }]}>{t(`language.${option}`)}</Text>
                {option === 'system' ? (
                  <Text style={[styles.detail, { color: colors.textSecondary }]}>
                    {t('language.systemDetail')}
                  </Text>
                ) : null}
              </View>
              {active ? <Ionicons name="checkmark" size={20} color={colors.tint} /> : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.note, { color: colors.textTertiary }]}>{t('language.note')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  label: Type.body,
  detail: Type.caption,
  note: {
    ...Type.caption,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },
});
