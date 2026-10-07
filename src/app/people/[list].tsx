import { Redirect, Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { FollowButton } from '@/components/follow-button';
import { MessageState } from '@/components/message-state';
import { Spacing, Type } from '@/constants/theme';
import { useT } from '@/i18n';
import type { TranslationKey } from '@/i18n';
import { useAuth } from '@/lib/auth-context';
import { useRelations } from '@/lib/relations-context';
import { errorMessage } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import {
  fetchRelatedProfiles,
  type RelatedProfile,
  type RelationKind,
} from '@/services/relations';

type ListName = 'following' | 'muted' | 'blocked';

const LISTS: Record<
  ListName,
  { kind: RelationKind; title: TranslationKey; emptyTitle: TranslationKey; emptyDetail: TranslationKey }
> = {
  following: {
    kind: 'follow',
    title: 'people.following.title',
    emptyTitle: 'people.following.emptyTitle',
    emptyDetail: 'people.following.emptyDetail',
  },
  muted: {
    kind: 'mute',
    title: 'people.muted.title',
    emptyTitle: 'people.muted.emptyTitle',
    emptyDetail: 'people.muted.emptyDetail',
  },
  blocked: {
    kind: 'block',
    title: 'people.blocked.title',
    emptyTitle: 'people.blocked.emptyTitle',
    emptyDetail: 'people.blocked.emptyDetail',
  },
};

function isListName(value: string | undefined): value is ListName {
  return value === 'following' || value === 'muted' || value === 'blocked';
}

/**
 * One of the reader's own lists: the people they chose to follow, mute or
 * block. These exist to review and undo a choice — never as a ranking, so
 * nobody else's lists or counts are visible anywhere.
 */
export default function PeopleListScreen() {
  const { list } = useLocalSearchParams<{ list: string }>();
  const { session } = useAuth();
  const { colors } = useTheme();
  const t = useT();
  const { isMuted, isBlocked, isPending, toggleMute, unblock } = useRelations();
  const userId = session?.user.id ?? '';

  const [people, setPeople] = useState<RelatedProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const config = isListName(list) ? LISTS[list] : null;

  const load = useCallback(async () => {
    if (!config) return;
    try {
      setError(null);
      setPeople(await fetchRelatedProfiles(config.kind, userId));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [config, userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!config) return <Redirect href="/(tabs)/profile" />;

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleToggleMute = async (person: RelatedProfile) => {
    try {
      await toggleMute(person.id);
    } catch (e) {
      Alert.alert(t('user.muteFailed'), errorMessage(e));
    }
  };

  const handleUnblock = async (person: RelatedProfile) => {
    try {
      await unblock(person.id);
    } catch (e) {
      Alert.alert(t('people.unblockFailed'), errorMessage(e));
    }
  };

  const renderAction = (person: RelatedProfile) => {
    if (config.kind === 'follow') return <FollowButton userId={person.id} />;
    if (config.kind === 'mute') {
      const muted = isMuted(person.id);
      return (
        <Button
          title={muted ? t('user.unmute') : t('user.mute')}
          variant="outline"
          compact
          disabled={isPending(person.id)}
          onPress={() => void handleToggleMute(person)}
        />
      );
    }
    const blocked = isBlocked(person.id);
    return (
      <Button
        title={blocked ? t('people.unblock') : t('people.blocked')}
        variant="outline"
        compact
        // Re-blocking from here would need the full confirmation; use the profile.
        disabled={!blocked || isPending(person.id)}
        onPress={() => void handleUnblock(person)}
      />
    );
  };

  if (people === null && error !== null) {
    return (
      <>
        <Stack.Screen options={{ title: t(config.title) }} />
        <MessageState
          icon="cloud-offline-outline"
          title={t('people.loadFailed', { list: t(config.title) })}
          detail={error}
          actionTitle={t('common.retry')}
          onAction={() => void load()}
        />
      </>
    );
  }

  // Blocked people's profiles are hidden, so their row can't open anything.
  const canOpen = config.kind !== 'block';

  return (
    <>
      <Stack.Screen options={{ title: t(config.title) }} />
      <FlatList
        style={[styles.screen, { backgroundColor: colors.background }]}
        // Rows for people just removed from the list stay until the next
        // load so the reader can undo with one tap.
        data={people ?? []}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        renderItem={({ item }) => (
          <View style={[styles.row, { borderBottomColor: colors.border }]}>
            <Pressable
              accessibilityRole={canOpen ? 'button' : undefined}
              accessibilityLabel={canOpen ? t('common.openProfile', { name: item.display_name }) : undefined}
              onPress={canOpen ? () => router.push(`/user/${item.id}`) : undefined}
              disabled={!canOpen}
              style={({ pressed }) => [styles.person, pressed && canOpen && styles.pressed]}
            >
              <Avatar url={item.avatar_url} name={item.display_name} size={44} />
              <View style={styles.names}>
                <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={1}>
                  {item.display_name}
                </Text>
                <Text
                  style={[styles.username, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  @{item.username}
                </Text>
              </View>
            </Pressable>
            {renderAction(item)}
          </View>
        )}
        ListEmptyComponent={
          people === null ? null : (
            <MessageState
              icon="people-outline"
              title={t(config.emptyTitle)}
              detail={t(config.emptyDetail)}
              actionTitle={config.kind === 'follow' ? t('feed.explorePeople') : undefined}
              onAction={config.kind === 'follow' ? () => router.navigate('/') : undefined}
            />
          )
        }
        contentContainerStyle={people?.length === 0 ? styles.emptyGrow : undefined}
      />
    </>
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
