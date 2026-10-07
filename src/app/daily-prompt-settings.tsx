import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Alert, Linking, StyleSheet, Switch, Text, View } from 'react-native';

import { Spacing, Type } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { useAuth } from '@/lib/auth-context';
import { useDailyPromptReminder } from '@/lib/daily-prompt-reminder';
import { errorMessage } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { NotificationPermissionDenied } from '@/services/notifications';

function toDate(time: string): Date {
  const [h, m] = time.split(':').map((v) => Number(v));
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 19, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

function toTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Settings → Daily prompt reminder. Off by default. One switch, one time.
 * Turning it on is the only moment the app asks for notification permission.
 * There is no second reminder, no badge, nothing if a day is missed.
 */
export default function DailyPromptSettingsScreen() {
  const { session } = useAuth();
  const { colors, scheme } = useTheme();
  const { t, locale } = useI18n();
  const userId = session?.user.id ?? '';
  const { ready, settings, saving, save } = useDailyPromptReminder(userId, locale);
  const [pickerTime, setPickerTime] = useState<Date | null>(null);

  const handleError = (e: unknown) => {
    if (e instanceof NotificationPermissionDenied) {
      Alert.alert(t('notify.permissionTitle'), t('notify.permissionBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('notify.openSettings'), onPress: () => void Linking.openSettings() },
      ]);
      return;
    }
    Alert.alert(t('notify.failed'), errorMessage(e));
  };

  const toggle = async (enabled: boolean) => {
    try {
      await save({ ...settings, enabled });
    } catch (e) {
      handleError(e);
    }
  };

  const changeTime = async (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'dismissed' || !date) return;
    const preferredTime = toTime(date);
    setPickerTime(date);
    if (preferredTime === settings.preferredTime) return;
    try {
      await save({ ...settings, preferredTime });
    } catch (e) {
      setPickerTime(null);
      handleError(e);
    }
  };

  const disabled = !ready || saving;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <View style={styles.rowText}>
          <Text style={[styles.label, { color: colors.text }]}>{t('notify.toggle')}</Text>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>{t('notify.toggleDetail')}</Text>
        </View>
        <Switch
          accessibilityLabel={t('notify.toggle')}
          value={settings.enabled}
          onValueChange={(v) => void toggle(v)}
          disabled={disabled}
          trackColor={{ true: colors.tint, false: colors.border }}
          ios_backgroundColor={colors.border}
        />
      </View>

      {settings.enabled ? (
        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.text }]}>{t('notify.time')}</Text>
          <DateTimePicker
            accessibilityLabel={t('notify.time')}
            value={pickerTime ?? toDate(settings.preferredTime)}
            mode="time"
            display="compact"
            minuteInterval={5}
            themeVariant={scheme}
            disabled={disabled}
            onChange={(event, date) => void changeTime(event, date)}
          />
        </View>
      ) : null}

      <Text style={[styles.note, { color: colors.textTertiary }]}>{t('notify.philosophy')}</Text>
      {settings.enabled ? (
        <Text style={[styles.note, { color: colors.textTertiary }]}>{t('notify.deviceNote')}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.lg,
    minHeight: 56,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
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
});
