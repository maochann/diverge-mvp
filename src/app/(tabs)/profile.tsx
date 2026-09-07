import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { MessageState } from '@/components/message-state';
import { PostCard } from '@/components/post-card';
import { PostSkeletonList } from '@/components/post-skeleton';
import { Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { deletePost, fetchUserPosts, setLiked } from '@/services/posts';
import type { FeedPost } from '@/types';

export default function ProfileScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const { colors } = useTheme();
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
      Alert.alert('Could not update like', errorMessage(e));
    }
  };

  const handleDelete = async (post: FeedPost) => {
    try {
      await deletePost(post.id);
      setPosts((current) => (current ?? []).filter((p) => p.id !== post.id));
    } catch (e) {
      Alert.alert('Could not delete post', errorMessage(e));
    }
  };

  if (!profile) {
    return (
      <MessageState
        icon="person-circle-outline"
        title="Couldn't load your profile"
        detail="Check your connection and try again."
        actionTitle="Retry"
        onAction={() => void refreshProfile().catch(() => undefined)}
      />
    );
  }

  const postCount = posts?.length ?? 0;
  const countLabel =
    posts === null ? '' : `${postCount} ${postCount === 1 ? 'post' : 'posts'}`;

  return (
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
            <Button
              title="Edit profile"
              variant="outline"
              compact
              onPress={() => router.push('/edit-profile')}
            />
          </View>
        </View>
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
            title="Couldn't load your posts"
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
            title="You haven't posted yet"
            detail="Your posts will show up here."
            actionTitle="Create a post"
            onAction={() => router.navigate('/create')}
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
