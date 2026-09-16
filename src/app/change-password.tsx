import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

/**
 * Choose a new password. Reached from Settings, or automatically after a
 * password-reset link signed the user in (`recovering`).
 */
export default function ChangePasswordScreen() {
  const { updatePassword, recovering } = useAuth();
  const { colors } = useTheme();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSave = password.length >= 8 && confirm === password && !saving;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePassword(password);
      Alert.alert('Password updated', 'Use your new password next time you log in.', [
        { text: 'OK', onPress: () => router.replace('/') },
      ]);
    } catch (e) {
      Alert.alert('Could not update password', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {recovering ? (
          <Text style={[styles.intro, { color: colors.textSecondary }]}>
            You&apos;re signed in through your reset link. Choose a new password to finish.
          </Text>
        ) : null}
        <View style={styles.form}>
          <TextField
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder="At least 8 characters"
            error={tooShort ? 'At least 8 characters.' : null}
            autoFocus
          />
          <TextField
            label="Confirm new password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            error={mismatch ? "Passwords don't match." : null}
          />
          <Button title="Save password" onPress={handleSave} disabled={!canSave} loading={saving} />
          {recovering ? null : (
            <Button title="Cancel" variant="secondary" onPress={() => router.back()} />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  intro: Type.body,
  form: {
    gap: Spacing.lg,
  },
});
