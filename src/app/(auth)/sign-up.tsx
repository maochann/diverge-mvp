import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { LEGAL_URLS } from '@/constants/legal';
import { Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const usernameError =
    username.length > 0 && !USERNAME_PATTERN.test(username.trim().toLowerCase())
      ? '3–20 characters: lowercase letters, numbers, underscores.'
      : null;
  const passwordError =
    password.length > 0 && password.length < 8 ? 'At least 8 characters.' : null;
  const canSubmit =
    email.trim().length > 0 &&
    password.length >= 8 &&
    displayName.trim().length > 0 &&
    USERNAME_PATTERN.test(username.trim().toLowerCase()) &&
    agreed &&
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
            <Text style={[styles.title, { color: colors.text }]}>Create account</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              It only takes a minute.
            </Text>
          </View>

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
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
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

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed }}
              accessibilityLabel="I agree to the Terms of Use and Privacy Policy"
              onPress={() => setAgreed((a) => !a)}
              hitSlop={6}
              style={styles.agreeRow}
            >
              <Ionicons
                name={agreed ? 'checkbox' : 'square-outline'}
                size={22}
                color={agreed ? colors.tint : colors.textTertiary}
              />
              <Text style={[styles.agreeText, { color: colors.textSecondary }]}>
                I agree to the{' '}
                <Text
                  style={{ color: colors.tint }}
                  onPress={() => void Linking.openURL(LEGAL_URLS.terms)}
                >
                  Terms of Use
                </Text>{' '}
                and{' '}
                <Text
                  style={{ color: colors.tint }}
                  onPress={() => void Linking.openURL(LEGAL_URLS.privacy)}
                >
                  Privacy Policy
                </Text>
                .
              </Text>
            </Pressable>

            {error ? (
              <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
            ) : null}

            <Button
              title="Sign up"
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={submitting}
              style={styles.submit}
            />
          </View>

          <Link href="/sign-in" style={[styles.link, { color: colors.tint }]}>
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
  title: Type.title,
  subtitle: Type.body,
  form: {
    gap: Spacing.lg,
  },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  agreeText: {
    ...Type.caption,
    flex: 1,
  },
  error: {
    ...Type.caption,
    textAlign: 'center',
  },
  submit: {
    marginTop: Spacing.xs,
  },
  link: {
    ...Type.bodyStrong,
    textAlign: 'center',
  },
});
