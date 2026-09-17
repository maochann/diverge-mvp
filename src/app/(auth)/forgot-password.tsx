import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

export default function ForgotPasswordScreen() {
  const { requestPasswordReset, verifyRecoveryCode } = useAuth();
  const { colors } = useTheme();
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
            <Text style={[styles.title, { color: colors.text }]}>Reset password</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {sent
                ? `If that address has an account, a 6-digit code is on its way to ${email.trim()}. Enter it below.`
                : "We'll email you a 6-digit code so you can choose a new password."}
            </Text>
          </View>

          {sent ? (
            <View style={styles.form}>
              <TextField
                label="Code from the email"
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                placeholder="123456"
                autoFocus
              />
              {error ? (
                <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
              ) : null}
              <Button
                title="Continue"
                onPress={handleVerify}
                disabled={code.length !== 6 || submitting}
                loading={submitting}
              />
              <Button
                title="Send a new code"
                variant="secondary"
                onPress={handleSubmit}
                disabled={submitting}
              />
              <Button title="Back to log in" variant="outline" onPress={() => router.back()} />
            </View>
          ) : (
            <View style={styles.form}>
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder="you@example.com"
                autoFocus
              />
              {error ? (
                <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
              ) : null}
              <Button
                title="Send reset link"
                onPress={handleSubmit}
                disabled={email.trim().length === 0 || submitting}
                loading={submitting}
              />
              <Button title="Cancel" variant="secondary" onPress={() => router.back()} />
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
