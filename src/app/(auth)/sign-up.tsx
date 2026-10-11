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
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/supabase';
import { useSerif, useTheme } from '@/lib/theme';

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const { colors } = useTheme();
  const t = useT();
  const serif = useSerif();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const usernameError =
    username.length > 0 && !USERNAME_PATTERN.test(username.trim().toLowerCase())
      ? t('signUp.usernameRule')
      : null;
  const passwordError =
    password.length > 0 && password.length < 8 ? t('auth.passwordRule') : null;
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
        Alert.alert(t('signUp.confirmTitle'), t('signUp.confirmBody'), [
          { text: t('common.ok'), onPress: () => router.back() },
        ]);
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
            <Text style={[styles.title, serif.strong, { color: colors.text }]}>{t('signUp.title')}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('signUp.subtitle')}
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
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder={t('auth.passwordHint')}
              error={passwordError}
            />
            <TextField
              label={t('signUp.username')}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t('signUp.usernamePlaceholder')}
              error={usernameError}
            />
            <TextField
              label={t('signUp.displayName')}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={t('signUp.displayNamePlaceholder')}
            />

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed }}
              accessibilityLabel={t('signUp.agreeA11y')}
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
                {t('signUp.agreePrefix')}
                <Text
                  style={{ color: colors.tint }}
                  onPress={() => void Linking.openURL(LEGAL_URLS.terms)}
                >
                  {t('signUp.terms')}
                </Text>
                {t('signUp.and')}
                <Text
                  style={{ color: colors.tint }}
                  onPress={() => void Linking.openURL(LEGAL_URLS.privacy)}
                >
                  {t('signUp.privacy')}
                </Text>
                {t('signUp.agreeSuffix')}
              </Text>
            </Pressable>

            {error ? (
              <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
            ) : null}

            <Button
              title={t('signUp.submit')}
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={submitting}
              style={styles.submit}
            />
          </View>

          <Link href="/sign-in" style={[styles.link, { color: colors.tint }]}>
            {t('signUp.haveAccount')}
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
