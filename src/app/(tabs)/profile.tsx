import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { MessageState } from '@/components/message-state';
import { PostCard } from '@/components/post-card';
import { PostSkeletonList } from '@/components/post-skeleton';
import { Spacing, Type } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { useAuth } from '@/lib/auth-context';
import { rememberTab } from '@/lib/last-tab';
import { useRelations } from '@/lib/relations-context';
import { errorMessage } from '@/lib/supabase';
import { useSerif, useTheme } from '@/lib/theme';
import { deletePost, fetchUserPosts, setLiked } from '@/services/posts';
import type { FeedPost } from '@/types';

export default function ProfileScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const { sets } = useRelations();
  const { colors } = useTheme();
  const { t, tp } = useI18n();
  const serif = useSerif();
  const insets = useSafeAreaInsets();
  const userId = session?.user.id ?? '';

  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadPosts = useCallback(async () => {
    try {
      setPostsError(null);
      setPosts(await fetchUserPosts(userId, userId));
    } catch (e) {
      setPostsError(errorMessage(e));
    }
  }, [userId]);

  // Refresh on focus so profile edits and new posts show immediately.
  useFocusEffect(
    useCallback(() => {
      rememberTab('/profile');
      refreshProfile().catch(() => {
        // Falls through to the "couldn't load" state below when profile is null.
      });
      void loadPosts();
    }, [refreshProfile, loadPosts]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile().catch(() => undefined), loadPosts()]);
    setRefreshing(false);
  };

  const handleToggleLike = async (post: FeedPost) => {
    const nextLiked = !post.liked_by_me;
    setPosts((current) =>
      (current ?? []).map((p) =>
        p.id === post.id
          ? {
              ...p,
              liked_by_me: nextLiked,
              like_count: p.like_count + (nextLiked ? 1 : -1),
            }
          : p,
      ),
    );
    try {
      await setLiked(post.id, userId, nextLiked);
    } catch (e) {
      setPosts((current) =>
        (current ?? []).map((p) => (p.id === post.id ? post : p)),
      );
      Alert.alert(t('feed.likeFailed'), errorMessage(e));
    }
  };

  const handleDelete = async (post: FeedPost) => {
    try {
      await deletePost(post.id);
      setPosts((current) => (current ?? []).filter((p) => p.id !== post.id));
    } catch (e) {
      Alert.alert(t('feed.deleteFailed'), errorMessage(e));
    }
  };

  if (!profile) {
    return (
      <MessageState
        icon="person-circle-outline"
        title={t('profile.loadFailed')}
        detail={t('profile.loadFailedDetail')}
        actionTitle={t('common.retry')}
        onAction={() => void refreshProfile().catch(() => undefined)}
      />
    );
  }

  const postCount = posts?.length ?? 0;
  const countLabel = posts === null ? '' : tp('profile.postCount', postCount);

  return (
    <FlatList
      style={[styles.screen, { backgroundColor: colors.background }]}
      data={posts ?? []}
      keyExtractor={(item) => item.id}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      ListHeaderComponent={
        <>
        <View style={[styles.headerBlock, { borderBottomColor: colors.border, paddingTop: insets.top + Spacing.sm }]}>
          <View style={styles.topRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('nav.settings')}
              onPress={() => router.push('/settings')}
              hitSlop={10}
              style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}
            >
              <Ionicons name="settings-outline" size={22} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.identity}>
            <Avatar url={profile.avatar_url} name={profile.display_name} size={64} />
            <View style={styles.names}>
              <Text style={[styles.displayName, serif.strong, { color: colors.text }]} numberOfLines={2}>
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

          {/* Only your own following is ever shown; nobody has a follower count.
              Muted and Blocked are management, so they live in Settings. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('profile.followingA11y')}
            onPress={() => router.push('/people/following')}
            hitSlop={4}
            style={({ pressed }) => [styles.followingRow, pressed && styles.pressed]}
          >
            <Text style={[styles.followingLabel, { color: colors.text }]}>
              {sets ? t('profile.followingCount', { n: sets.following.size }) : t('profile.following')}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </Pressable>

          <View style={styles.metaRow}>
            <Text style={[styles.count, { color: colors.textSecondary }]}>{countLabel}</Text>
            <Button
              title={t('profile.edit')}
              variant="outline"
              compact
              onPress={() => router.push('/edit-profile')}
            />
          </View>
        </View>
        {posts && posts.length > 0 ? (
          <Text style={[styles.sectionLabel, serif.regular, { color: colors.textSecondary }]}>{t('profile.posts')}</Text>
        ) : null}
        </>
      }
      renderItem={({ item }) => (
        <PostCard
          post={item}
          isOwn
          onToggleLike={handleToggleLike}
          onOpenComments={(p) => router.push(`/post/${p.id}`)}
          onDelete={handleDelete}
        />
      )}
      ListEmptyComponent={
        postsError !== null ? (
          <MessageState
            compact
            icon="cloud-offline-outline"
            title={t('profile.postsLoadFailed')}
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
            title={t('profile.empty.title')}
            detail={t('profile.empty.detail')}
            actionTitle={t('profile.createPost')}
            onAction={() => router.push('/compose')}
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerBlock: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    minHeight: 32,
  },
  settingsButton: {
    minWidth: 44,
    minHeight: 32,
    alignItems: 'flex-end',
    justifyContent: 'center',
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
  followingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    alignSelf: 'flex-start',
    minHeight: 28,
  },
  followingLabel: Type.captionStrong,
  pressed: {
    opacity: 0.6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  count: Type.caption,
});
