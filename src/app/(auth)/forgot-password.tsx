import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { Spacing, Type } from '@/constants/theme';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/supabase';
import { useSerif, useTheme } from '@/lib/theme';

export default function ForgotPasswordScreen() {
  const { requestPasswordReset, verifyRecoveryCode } = useAuth();
  const { colors } = useTheme();
  const t = useT();
  const serif = useSerif();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await verifyRecoveryCode(email, code);
      // Signed in through the code: the root layout sends us to Change password.
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.heading}>
            <Text style={[styles.title, serif.strong, { color: colors.text }]}>{t('forgot.title')}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {sent ? t('forgot.introSent', { email: email.trim() }) : t('forgot.intro')}
            </Text>
          </View>

          {sent ? (
            <View style={styles.form}>
              <TextField
                label={t('forgot.codeLabel')}
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 8))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                placeholder={t('forgot.codePlaceholder')}
                autoFocus
              />
              {error ? (
                <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
              ) : null}
              <Button
                title={t('common.continue')}
                onPress={handleVerify}
                disabled={code.length < 6 || submitting}
                loading={submitting}
              />
              <Button
                title={t('forgot.newCode')}
                variant="secondary"
                onPress={handleSubmit}
                disabled={submitting}
              />
              <Button title={t('forgot.backToLogin')} variant="outline" onPress={() => router.back()} />
            </View>
          ) : (
            <View style={styles.form}>
              <TextField
                label={t('auth.email')}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder={t('auth.emailPlaceholder')}
                autoFocus
              />
              {error ? (
                <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
              ) : null}
              <Button
                title={t('forgot.sendCode')}
                onPress={handleSubmit}
                disabled={email.trim().length === 0 || submitting}
                loading={submitting}
              />
              <Button title={t('common.cancel')} variant="secondary" onPress={() => router.back()} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.xl,
  },
  heading: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: Type.title,
  subtitle: {
    ...Type.body,
    textAlign: 'center',
  },
  form: {
    gap: Spacing.lg,
  },
  error: {
    ...Type.caption,
    textAlign: 'center',
  },
});
