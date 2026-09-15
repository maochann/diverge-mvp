import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { FollowButton } from '@/components/follow-button';
import { MessageState } from '@/components/message-state';
import { Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { fetchFollowingProfiles, type FollowedProfile } from '@/services/follows';

/**
 * The people you chose to hear from. This is a place to review that choice
 * and undo it — not a leaderboard, so there are no counts for anyone else.
 */
export default function FollowingScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const userId = session?.user.id ?? '';

  const [people, setPeople] = useState<FollowedProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setPeople(await fetchFollowingProfiles(userId));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (people === null && error !== null) {
    return (
      <MessageState
        icon="cloud-offline-outline"
        title="Couldn't load who you follow"
        detail={error}
        actionTitle="Retry"
        onAction={() => void load()}
      />
    );
  }

  return (
    <FlatList
      style={[styles.screen, { backgroundColor: colors.background }]}
      // Keep rows for people just unfollowed on this screen so the reader can
      // undo with one tap; they drop off on the next load.
      data={people ?? []}
      keyExtractor={(item) => item.id}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      renderItem={({ item }) => (
        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.display_name}'s profile`}
            onPress={() => router.push(`/user/${item.id}`)}
            style={({ pressed }) => [styles.person, pressed && styles.pressed]}
          >
            <Avatar url={item.avatar_url} name={item.display_name} size={44} />
            <View style={styles.names}>
              <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={1}>
                {item.display_name}
              </Text>
              <Text style={[styles.username, { color: colors.textSecondary }]} numberOfLines={1}>
                @{item.username}
              </Text>
            </View>
          </Pressable>
          <FollowButton userId={item.id} />
        </View>
      )}
      ListEmptyComponent={
        people === null ? null : (
          <MessageState
            icon="people-outline"
            title="You're not following anyone yet"
            detail="Following someone is how you choose whose posts reach your Catch up feed."
            actionTitle="Explore people"
            onAction={() => router.navigate('/')}
          />
        )
      }
      contentContainerStyle={people?.length === 0 ? styles.emptyGrow : undefined}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  person: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  names: {
    flex: 1,
    gap: 2,
  },
  displayName: Type.bodyStrong,
  username: Type.caption,
  pressed: {
    opacity: 0.6,
  },
  emptyGrow: {
    flexGrow: 1,
  },
});
