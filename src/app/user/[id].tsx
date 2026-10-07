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
import { useI18n } from '@/i18n';
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
  const { colors, scheme } = useTheme();
  const { t, tp } = useI18n();
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
      Alert.alert(t('feed.likeFailed'), errorMessage(e));
    }
  };

  const confirmBlock = () => {
    const name = profile?.display_name ?? t('block.thisPerson');
    Alert.alert(
      t('block.title', { name }),
      t('block.body'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('block.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await block(id);
              router.back();
            } catch (e) {
              Alert.alert(t('block.failed'), errorMessage(e));
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
      Alert.alert(t('user.muteFailed'), errorMessage(e));
    }
  };

  /** The "…" menu: the only place to mute, block or report a person. */
  const openMenu = () => {
    const muted = isMuted(id);
    const actions: { label: string; destructive?: boolean; run: () => void }[] = [
      { label: muted ? t('user.unmute') : t('user.mute'), run: () => void handleMute() },
      { label: t('user.report'), run: () => router.push(`/report?userId=${id}`) },
      { label: t('user.block'), destructive: true, run: confirmBlock },
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...actions.map((a) => a.label), t('common.cancel')],
          destructiveButtonIndex: actions.findIndex((a) => a.destructive),
          cancelButtonIndex: actions.length,
          userInterfaceStyle: scheme,
        },
        (index) => actions[index]?.run(),
      );
    } else {
      Alert.alert(profile?.display_name ?? t('user.options'), undefined, [
        ...actions.map((a) => ({
          text: a.label,
          style: a.destructive ? ('destructive' as const) : ('default' as const),
          onPress: a.run,
        })),
        { text: t('common.cancel'), style: 'cancel' as const },
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
          title={t('user.unavailable')}
          detail={isBlocked(id) ? t('user.blockedDetail') : undefined}
          actionTitle={isBlocked(id) ? t('user.goToBlocked') : undefined}
          onAction={isBlocked(id) ? () => router.replace('/people/blocked') : undefined}
        />
      </>
    );
  }

  if (profile === null && profileError !== null) {
    return (
      <MessageState
        icon="cloud-offline-outline"
        title={t('user.loadFailed')}
        detail={profileError}
        actionTitle={t('common.retry')}
        onAction={() => void loadProfile()}
      />
    );
  }

  if (profile === null) {
    return <PostSkeletonList count={2} />;
  }

  const postCount = posts?.length ?? 0;
  const countLabel = posts === null ? '' : tp('profile.postCount', postCount);

  return (
    <>
      <Stack.Screen
        options={{
          title: profile.display_name,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.moreOptions')}
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
          <>
          <View style={[styles.headerBlock, { borderBottomColor: colors.border }]}>
            <View style={styles.identity}>
              <Avatar url={profile.avatar_url} name={profile.display_name} size={64} />
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
                {isMuted(profile.id) ? `  ·  ${t('user.muted')}` : ''}
              </Text>
              <FollowButton userId={profile.id} />
            </View>
          </View>
          {posts && posts.length > 0 ? (
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('profile.posts')}</Text>
          ) : null}
          </>
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
              title={t('user.postsLoadFailed')}
              detail={postsError}
              actionTitle={t('common.retry')}
              onAction={() => void loadPosts()}
            />
          ) : posts === null ? (
            <PostSkeletonList count={2} />
          ) : (
            <MessageState
              compact
              icon="create-outline"
              title={t('user.noPosts.title')}
              detail={t('user.noPosts.detail', { name: profile.display_name })}
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
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
  displayName: Type.display,
  username: Type.caption,
  bio: Type.body,
  sectionLabel: {
    ...Type.chapter,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xs,
  },
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
