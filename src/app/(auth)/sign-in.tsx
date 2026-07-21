import { Link } from 'expo-router';
import { useState } from 'react';
import {
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

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0;

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
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Diverge</Text>
          <Text style={styles.subtitle}>Log in to your account</Text>

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
            autoComplete="password"
            placeholder="Your password"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title="Log in"
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={submitting}
          />

          <Link href="/sign-up" style={styles.link}>
            No account? Sign up
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
    fontSize: 32,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
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
