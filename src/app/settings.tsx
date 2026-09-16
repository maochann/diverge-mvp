import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LEGAL_URLS } from '@/constants/legal';
import { Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
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
  const [busy, setBusy] = useState(false);

  const confirmLogout = () => {
    Alert.alert('Log out?', 'You can log back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await signOut();
          } catch (e) {
            Alert.alert('Could not log out', errorMessage(e));
            setBusy(false);
          }
        },
      },
    ]);
  };

  /** Two confirmations: this cannot be undone and takes everything with it. */
  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete your account?',
      'Your profile, posts, comments, likes and photos will be permanently deleted. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Are you sure?', 'This is permanent.', [
              { text: 'Keep my account', style: 'cancel' },
              {
                text: 'Delete everything',
                style: 'destructive',
                onPress: async () => {
                  setBusy(true);
                  try {
                    await deleteMyAccount();
                    // The user no longer exists; clear the local session.
                    await signOut().catch(() => undefined);
                  } catch (e) {
                    Alert.alert('Could not delete account', errorMessage(e));
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
      <Section title="Account">
        <Row label="Email" detail={session?.user.email ?? ''} onPress={() => undefined} />
        <Row label="Change password" onPress={() => router.push('/change-password')} />
      </Section>

      <Section title="Privacy">
        <Row
          label="Muted accounts"
          detail={sets ? String(sets.muted.size) : undefined}
          onPress={() => router.push('/people/muted')}
        />
        <Row
          label="Blocked accounts"
          detail={sets ? String(sets.blocked.size) : undefined}
          onPress={() => router.push('/people/blocked')}
        />
      </Section>

      <Section title="About">
        <Row label="Terms of Use" external onPress={() => void Linking.openURL(LEGAL_URLS.terms)} />
        <Row
          label="Privacy Policy"
          external
          onPress={() => void Linking.openURL(LEGAL_URLS.privacy)}
        />
      </Section>

      <Section title="">
        <Row label="Log out" onPress={busy ? () => undefined : confirmLogout} />
        <Row
          label="Delete account"
          destructive
          onPress={busy ? () => undefined : confirmDeleteAccount}
        />
      </Section>
      <Text style={[styles.hint, { color: colors.textTertiary }]}>
        Deleting your account permanently removes your posts, comments and photos.
      </Text>
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
