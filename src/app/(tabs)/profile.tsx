import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { MessageState } from '@/components/message-state';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/supabase';

export default function ProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  // Refresh on focus so edits from the modal show immediately.
  useFocusEffect(
    useCallback(() => {
      refreshProfile().catch(() => {
        // Shown state falls back to the message below when profile is null.
      });
    }, [refreshProfile]),
  );

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (e) {
      Alert.alert('Could not log out', errorMessage(e));
    } finally {
      setSigningOut(false);
    }
  };

  if (!profile) {
    return (
      <MessageState
        title="Couldn't load your profile"
        detail="Check your connection and try again."
        actionTitle="Retry"
        onAction={() => void refreshProfile().catch(() => undefined)}
      />
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Avatar url={profile.avatar_url} name={profile.display_name} size={88} />
        <Text style={styles.displayName}>{profile.display_name}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      </View>

      <Button
        title="Edit profile"
        variant="secondary"
        onPress={() => router.push('/edit-profile')}
      />
      <Button
        title="Log out"
        variant="destructive"
        onPress={handleSignOut}
        loading={signingOut}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  displayName: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  username: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  bio: {
    fontSize: FontSize.md,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 21,
  },
});
