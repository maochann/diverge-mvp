import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/supabase';

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const usernameError =
    username.length > 0 && !USERNAME_PATTERN.test(username.trim().toLowerCase())
      ? '3–20 characters: lowercase letters, numbers, underscores.'
      : null;
  const passwordError =
    password.length > 0 && password.length < 8
      ? 'At least 8 characters.'
      : null;
  const canSubmit =
    email.trim().length > 0 &&
    password.length >= 8 &&
    displayName.trim().length > 0 &&
    USERNAME_PATTERN.test(username.trim().toLowerCase()) &&
    !submitting;

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const needsConfirmation = await signUp(email, password, username, displayName);
      if (needsConfirmation) {
        Alert.alert(
          'Confirm your email',
          'We sent you a confirmation link. Open it, then log in.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      }
      // Otherwise the session is live and the root layout switches to the app.
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Create account</Text>

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            placeholder="At least 8 characters"
            error={passwordError}
          />
          <TextField
            label="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="e.g. mao_t"
            error={usernameError}
          />
          <TextField
            label="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="How your name appears"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title="Sign up"
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={submitting}
          />

          <Link href="/sign-in" style={styles.link}>
            Already have an account? Log in
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  error: {
    color: Colors.danger,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  link: {
    color: Colors.tint,
    fontSize: FontSize.md,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
