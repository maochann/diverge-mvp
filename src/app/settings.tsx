import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LEGAL_URLS } from '@/constants/legal';
import { Spacing, Type } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { useAuth } from '@/lib/auth-context';
import { useDailyPromptReminder } from '@/lib/daily-prompt-reminder';
import { useRelations } from '@/lib/relations-context';
import { errorMessage } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { deleteMyAccount } from '@/services/relations';

interface RowProps {
  label: string;
  detail?: string;
  onPress: () => void;
  destructive?: boolean;
  external?: boolean;
}

function Row({ label, detail, onPress, destructive, external }: RowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.rowLabel, { color: destructive ? colors.danger : colors.text }]}>
        {label}
      </Text>
      <View style={styles.rowRight}>
        {detail ? (
          <Text style={[styles.rowDetail, { color: colors.textSecondary }]} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
        <Ionicons
          name={external ? 'open-outline' : 'chevron-forward'}
          size={16}
          color={colors.textTertiary}
        />
      </View>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>{title}</Text>
      {children}
    </View>
  );
}

/**
 * Settings: the place to manage yourself, as opposed to Profile, which is
 * the place to be seen. Muted and Blocked live here on purpose.
 */
export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const { sets } = useRelations();
  const { colors } = useTheme();
  const { t, preference, locale } = useI18n();
  const [busy, setBusy] = useState(false);
  const reminder = useDailyPromptReminder(session?.user.id ?? '', locale);
  const reminderEnabled = reminder.ready ? reminder.settings.enabled : null;

  const confirmLogout = () => {
    Alert.alert(t('settings.logoutTitle'), t('settings.logoutBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.logOut'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await signOut();
          } catch (e) {
            Alert.alert(t('settings.logoutFailed'), errorMessage(e));
            setBusy(false);
          }
        },
      },
    ]);
  };

  /** Two confirmations: this cannot be undone and takes everything with it. */
  const confirmDeleteAccount = () => {
    Alert.alert(
      t('settings.deleteTitle'),
      t('settings.deleteBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.continue'),
          style: 'destructive',
          onPress: () =>
            Alert.alert(t('settings.deleteSureTitle'), t('settings.deleteSureBody'), [
              { text: t('settings.keepAccount'), style: 'cancel' },
              {
                text: t('settings.deleteEverything'),
                style: 'destructive',
                onPress: async () => {
                  setBusy(true);
                  try {
                    await deleteMyAccount();
                    // The user no longer exists; clear the local session.
                    await signOut().catch(() => undefined);
                  } catch (e) {
                    Alert.alert(t('settings.deleteFailed'), errorMessage(e));
                    setBusy(false);
                  }
                },
              },
            ]),
        },
      ],
    );
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.container}
    >
      <Section title={t('settings.account')}>
        <Row label={t('settings.email')} detail={session?.user.email ?? ''} onPress={() => undefined} />
        <Row label={t('settings.changePassword')} onPress={() => router.push('/change-password')} />
      </Section>

      <Section title={t('settings.preferences')}>
        <Row
          label={t('settings.language')}
          detail={t(`language.${preference}`)}
          onPress={() => router.push('/language')}
        />
        <Row
          label={t('settings.dailyPrompt')}
          detail={reminderEnabled === null ? undefined : reminderEnabled ? t('settings.on') : t('settings.off')}
          onPress={() => router.push('/daily-prompt-settings')}
        />
      </Section>

      <Section title={t('settings.privacy')}>
        <Row
          label={t('settings.muted')}
          detail={sets ? String(sets.muted.size) : undefined}
          onPress={() => router.push('/people/muted')}
        />
        <Row
          label={t('settings.blocked')}
          detail={sets ? String(sets.blocked.size) : undefined}
          onPress={() => router.push('/people/blocked')}
        />
      </Section>

      <Section title={t('settings.about')}>
        <Row label={t('settings.aboutDiverge')} onPress={() => router.push('/welcome?replay=1')} />
        <Row label={t('settings.terms')} external onPress={() => void Linking.openURL(LEGAL_URLS.terms)} />
        <Row
          label={t('settings.privacyPolicy')}
          external
          onPress={() => void Linking.openURL(LEGAL_URLS.privacy)}
        />
      </Section>

      <Section title="">
        <Row label={t('settings.logOut')} onPress={busy ? () => undefined : confirmLogout} />
        <Row
          label={t('settings.deleteAccount')}
          destructive
          onPress={busy ? () => undefined : confirmDeleteAccount}
        />
      </Section>
      <Text style={[styles.hint, { color: colors.textTertiary }]}>{t('settings.hint')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    paddingBottom: Spacing.xxl,
  },
  section: {
    marginTop: Spacing.xl,
  },
  sectionTitle: {
    ...Type.captionStrong,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: Type.body,
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
    maxWidth: '60%',
  },
  rowDetail: Type.caption,
  hint: {
    ...Type.caption,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },
});
