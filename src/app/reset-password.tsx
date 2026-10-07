import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { MessageState } from '@/components/message-state';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';

/**
 * Where password-reset links land. The root layout already exchanges a
 * valid link for a session and moves on; this screen only shows while that
 * happens, or explains what went wrong (an expired or already-used link)
 * and points back to the code flow.
 */
export default function ResetPasswordScreen() {
  const { error_description: errorDescription, error } = useLocalSearchParams<{
    error?: string;
    error_description?: string;
  }>();
  const { session, recovering } = useAuth();
  const { colors } = useTheme();
  const t = useT();
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    if (recovering && session) router.replace('/change-password');
  }, [recovering, session]);

  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 4000);
    return () => clearTimeout(t);
  }, []);

  if (error || waited) {
    return (
      <MessageState
        icon="mail-unread-outline"
        title={t('resetPassword.failedTitle')}
        detail={
          errorDescription
            ? t('resetPassword.failedDetailWithReason', { reason: errorDescription })
            : t('resetPassword.failedDetail')
        }
        actionTitle={t('resetPassword.getCode')}
        onAction={() => router.replace(session ? '/change-password' : '/forgot-password')}
      />
    );
  }

  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
