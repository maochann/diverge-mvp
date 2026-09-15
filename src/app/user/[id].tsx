import { Ionicons } from '@expo/vector-icons';
import { Redirect, Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { FollowButton } from '@/components/follow-button';
import { MessageState } from '@/components/message-state';
import { PostCard } from '@/components/post-card';
import { PostSkeletonList } from '@/components/post-skeleton';
import { Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useRelations } from '@/lib/relations-context';
import { errorMessage } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { fetchUserPosts, setLiked } from '@/services/posts';
import { getProfile } from '@/services/profiles';
import type { FeedPost, Profile } from '@/types';

/**
 * Someone else's profile: who they are, what they've posted, and the one
 * place to follow or unfollow them. No follower or following counts — those
 * numbers turn a small group into a ranking.
 */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { colors } = useTheme();
  const { isMuted, isBlocked, isPending, toggleMute, block } = useRelations();
  const viewerId = session?.user.id ?? '';

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      setProfileError(null);
      setProfile(await getProfile(id));
    } catch (e) {
      setProfileError(errorMessage(e));
    }
  }, [id]);

  const loadPosts = useCallback(async () => {
    try {
      setPostsError(null);
      setPosts(await fetchUserPosts(id, viewerId));
    } catch (e) {
      setPostsError(errorMessage(e));
    }
  }, [id, viewerId]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
      void loadPosts();
    }, [loadProfile, loadPosts]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadProfile(), loadPosts()]);
    setRefreshing(false);
  };

  const handleToggleLike = async (post: FeedPost) => {
    const nextLiked = !post.liked_by_me;
    setPosts((current) =>
      (current ?? []).map((p) =>
        p.id === post.id
          ? { ...p, liked_by_me: nextLiked, like_count: p.like_count + (nextLiked ? 1 : -1) }
          : p,
      ),
    );
    try {
      await setLiked(post.id, viewerId, nextLiked);
    } catch (e) {
      setPosts((current) => (current ?? []).map((p) => (p.id === post.id ? post : p)));
      Alert.alert('Could not update like', errorMessage(e));
    }
  };

  const confirmBlock = () => {
    const name = profile?.display_name ?? 'this person';
    Alert.alert(
      `Block ${name}?`,
      "You won't see each other's posts, comments or profiles, and any follows between you are removed. They won't be told.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await block(id);
              router.back();
            } catch (e) {
              Alert.alert('Could not block', errorMessage(e));
            }
          },
        },
      ],
    );
  };

  const handleMute = async () => {
    try {
      await toggleMute(id);
    } catch (e) {
      Alert.alert('Could not update mute', errorMessage(e));
    }
  };

  /** The "…" menu: the only place to mute, block or report a person. */
  const openMenu = () => {
    const muted = isMuted(id);
    const actions: { label: string; destructive?: boolean; run: () => void }[] = [
      { label: muted ? 'Unmute' : 'Mute', run: () => void handleMute() },
      { label: 'Report', run: () => router.push(`/report?userId=${id}`) },
      { label: 'Block', destructive: true, run: confirmBlock },
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...actions.map((a) => a.label), 'Cancel'],
          destructiveButtonIndex: actions.findIndex((a) => a.destructive),
          cancelButtonIndex: actions.length,
          userInterfaceStyle: colors.background === '#ffffff' ? 'light' : 'dark',
        },
        (index) => actions[index]?.run(),
      );
    } else {
      Alert.alert(profile?.display_name ?? 'Options', undefined, [
        ...actions.map((a) => ({
          text: a.label,
          style: a.destructive ? ('destructive' as const) : ('default' as const),
          onPress: a.run,
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  };

  // Your own profile lives in the tab bar; there is nothing to follow here.
  if (id === viewerId) {
    return <Redirect href="/(tabs)/profile" />;
  }

  // Blocked either way: the row is hidden by the database, so nothing loads.
  if (isBlocked(id) || (profile === null && profileError !== null && posts?.length === 0)) {
    return (
      <>
        <Stack.Screen options={{ title: '' }} />
        <MessageState
          icon="eye-off-outline"
          title="This profile isn't available"
          detail={
            isBlocked(id)
              ? 'You blocked this account. You can unblock it from your Blocked list.'
              : undefined
          }
          actionTitle={isBlocked(id) ? 'Go to Blocked list' : undefined}
          onAction={isBlocked(id) ? () => router.replace('/people/blocked') : undefined}
        />
      </>
    );
  }

  if (profile === null && profileError !== null) {
    return (
      <MessageState
        icon="cloud-offline-outline"
        title="Couldn't load this profile"
        detail={profileError}
        actionTitle="Retry"
        onAction={() => void loadProfile()}
      />
    );
  }

  if (profile === null) {
    return <PostSkeletonList count={2} />;
  }

  const postCount = posts?.length ?? 0;
  const countLabel =
    posts === null ? '' : `${postCount} ${postCount === 1 ? 'post' : 'posts'}`;

  return (
    <>
      <Stack.Screen
        options={{
          title: profile.display_name,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="More options"
              onPress={openMenu}
              disabled={isPending(id)}
              hitSlop={10}
              style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      <FlatList
        style={[styles.screen, { backgroundColor: colors.background }]}
        data={posts ?? []}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListHeaderComponent={
          <View style={[styles.headerBlock, { borderBottomColor: colors.border }]}>
            <View style={styles.identity}>
              <Avatar url={profile.avatar_url} name={profile.display_name} size={72} />
              <View style={styles.names}>
                <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={2}>
                  {profile.display_name}
                </Text>
                <Text style={[styles.username, { color: colors.textSecondary }]}>
                  @{profile.username}
                </Text>
              </View>
            </View>

            {profile.bio ? (
              <Text style={[styles.bio, { color: colors.text }]}>{profile.bio}</Text>
            ) : null}

            <View style={styles.metaRow}>
              <Text style={[styles.count, { color: colors.textSecondary }]}>
                {countLabel}
                {isMuted(profile.id) ? '  ·  Muted' : ''}
              </Text>
              <FollowButton userId={profile.id} />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            isOwn={false}
            onToggleLike={handleToggleLike}
            onOpenComments={(p) => router.push(`/post/${p.id}`)}
            onDelete={() => undefined}
            onAuthorBlocked={() => router.back()}
          />
        )}
        ListEmptyComponent={
          postsError !== null ? (
            <MessageState
              compact
              icon="cloud-offline-outline"
              title="Couldn't load their posts"
              detail={postsError}
              actionTitle="Retry"
              onAction={() => void loadPosts()}
            />
          ) : posts === null ? (
            <PostSkeletonList count={2} />
          ) : (
            <MessageState
              compact
              icon="create-outline"
              title="No posts yet"
              detail={`${profile.display_name} hasn't posted anything.`}
            />
          )
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerBlock: {
    padding: Spacing.lg,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  names: {
    flex: 1,
    gap: 2,
  },
  displayName: Type.title,
  username: Type.body,
  bio: Type.body,
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  count: Type.caption,
  menuButton: {
    padding: Spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
});
