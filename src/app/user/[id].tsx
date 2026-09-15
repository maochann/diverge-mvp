import { Redirect, Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { FollowButton } from '@/components/follow-button';
import { MessageState } from '@/components/message-state';
import { PostCard } from '@/components/post-card';
import { PostSkeletonList } from '@/components/post-skeleton';
import { Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
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

  // Your own profile lives in the tab bar; there is nothing to follow here.
  if (id === viewerId) {
    return <Redirect href="/(tabs)/profile" />;
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
      <Stack.Screen options={{ title: profile.display_name }} />
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
              <Text style={[styles.count, { color: colors.textSecondary }]}>{countLabel}</Text>
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
});
