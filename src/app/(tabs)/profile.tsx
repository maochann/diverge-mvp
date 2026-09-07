import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { MessageState } from '@/components/message-state';
import { PostCard } from '@/components/post-card';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/supabase';
import { deletePost, fetchUserPosts, setLiked } from '@/services/posts';
import type { FeedPost } from '@/types';

export default function ProfileScreen() {
  const { session, profile, signOut, refreshProfile } = useAuth();
  const userId = session?.user.id ?? '';

  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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

  const confirmSignOut = () => {
    Alert.alert('Log out?', 'You can log back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
          } catch (e) {
            Alert.alert('Could not log out', errorMessage(e));
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
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

  const postCount = posts?.length ?? 0;

  return (
    <FlatList
      style={styles.screen}
      data={posts ?? []}
      keyExtractor={(item) => item.id}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      ListHeaderComponent={
        <View style={styles.headerBlock}>
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
            onPress={confirmSignOut}
            loading={signingOut}
          />

          <Text style={styles.sectionTitle}>
            {posts === null
              ? 'Posts'
              : `${postCount} ${postCount === 1 ? 'post' : 'posts'}`}
          </Text>
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
            title="Couldn't load your posts"
            detail={postsError}
            actionTitle="Retry"
            onAction={() => void loadPosts()}
          />
        ) : posts === null ? null : (
          <MessageState
            title="You haven't posted yet"
            detail="Your posts will show up here."
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerBlock: {
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
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.sm,
  },
});
