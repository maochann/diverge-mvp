import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { MessageState } from '@/components/message-state';
import { PostCard } from '@/components/post-card';
import { PostSkeletonList } from '@/components/post-skeleton';
import { Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useRelations } from '@/lib/relations-context';
import { errorMessage } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { deletePost, fetchUserPosts, setLiked } from '@/services/posts';
import type { FeedPost } from '@/types';

export default function ProfileScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const { sets } = useRelations();
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

          {/* Only your own lists are ever shown; nobody has a follower count. */}
          <View style={styles.listRows}>
            {(
              [
                ['following', 'Following', sets?.following.size],
                ['muted', 'Muted', sets?.muted.size],
                ['blocked', 'Blocked', sets?.blocked.size],
              ] as const
            ).map(([list, label, count]) => (
              <Pressable
                key={list}
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={() => router.push(`/people/${list}`)}
                hitSlop={4}
                style={({ pressed }) => [styles.followingRow, pressed && styles.pressed]}
              >
                <Text style={[styles.followingLabel, { color: colors.text }]}>
                  {label}
                  {count !== undefined ? (
                    <Text style={{ color: colors.textSecondary }}> · {count}</Text>
                  ) : null}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </Pressable>
            ))}
          </View>

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
  listRows: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
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
