import { Link } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { Spacing, Type } from '@/constants/theme';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const { colors } = useTheme();
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      // Navigation happens automatically: the root layout swaps to the
      // protected group when the session appears.
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
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heading}>
            <Text style={[styles.title, { color: colors.text }]}>Diverge</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('signIn.subtitle')}
            </Text>
          </View>

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
            />
            <TextField
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              placeholder={t('auth.passwordPlaceholder')}
              onSubmitEditing={canSubmit ? handleSubmit : undefined}
              returnKeyType="go"
            />

            {error ? (
              <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
            ) : null}

            <Button
              title={t('signIn.submit')}
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={submitting}
              style={styles.submit}
            />
          </View>

          <View style={styles.links}>
            <Link href="/sign-up" style={[styles.link, { color: colors.tint }]}>
              {t('signIn.noAccount')}
            </Link>
            <Link href="/forgot-password" style={[styles.link, { color: colors.textSecondary }]}>
              {t('signIn.forgot')}
            </Link>
          </View>
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
    gap: Spacing.xs,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
  },
  subtitle: Type.body,
  form: {
    gap: Spacing.lg,
  },
  error: {
    ...Type.caption,
    textAlign: 'center',
  },
  submit: {
    marginTop: Spacing.xs,
  },
  links: {
    gap: Spacing.lg,
  },
  link: {
    ...Type.bodyStrong,
    textAlign: 'center',
  },
});
