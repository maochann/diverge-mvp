import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { updateProfile } from '@/services/profiles';
import { pickImage, uploadImage, type PickedImage } from '@/services/storage';

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const BIO_MAX = 160;

export default function EditProfileScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const [username, setUsername] = useState(profile?.username ?? '');
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [newAvatar, setNewAvatar] = useState<PickedImage | null>(null);
  const [saving, setSaving] = useState(false);

  const usernameError =
    username.length > 0 && !USERNAME_PATTERN.test(username.trim().toLowerCase())
      ? '3–20 characters: lowercase letters, numbers, underscores.'
      : null;
  const canSave =
    !saving &&
    displayName.trim().length > 0 &&
    USERNAME_PATTERN.test(username.trim().toLowerCase());

  const handlePickAvatar = async () => {
    try {
      const picked = await pickImage({ square: true });
      if (picked) setNewAvatar(picked);
    } catch (e) {
      Alert.alert('Could not open photos', errorMessage(e));
    }
  };

  const handleSave = async () => {
    if (!session || !profile) return;
    setSaving(true);
    try {
      let avatarUrl = profile.avatar_url;
      if (newAvatar) {
        avatarUrl = await uploadImage('avatars', session.user.id, newAvatar);
      }
      await updateProfile(session.user.id, {
        username: username.trim().toLowerCase(),
        display_name: displayName.trim(),
        bio: bio.trim() === '' ? null : bio.trim(),
        avatar_url: avatarUrl,
      });
      await refreshProfile();
      router.back();
    } catch (e) {
      Alert.alert('Could not save profile', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change profile image"
          onPress={handlePickAvatar}
          style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
        >
          <Avatar
            url={newAvatar?.uri ?? profile?.avatar_url ?? null}
            name={displayName || 'You'}
            size={96}
          />
          <Text style={[styles.avatarHint, { color: colors.tint }]}>Change photo</Text>
        </Pressable>

        <TextField
          label="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          error={usernameError}
        />
        <TextField
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
        />
        <TextField
          label={`Bio (optional) · ${bio.length}/${BIO_MAX}`}
          value={bio}
          onChangeText={(t) => setBio(t.slice(0, BIO_MAX))}
          multiline
          style={styles.bioInput}
          placeholder="A short line about you"
        />

        <Button
          title="Save"
          onPress={handleSave}
          disabled={!canSave}
          loading={saving}
          style={styles.save}
        />
        <Button title="Cancel" variant="secondary" onPress={() => router.back()} />
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
  avatarButton: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  avatarHint: Type.captionStrong,
  bioInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  save: {
    marginTop: Spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
});
