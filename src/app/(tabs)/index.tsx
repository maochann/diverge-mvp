import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, View } from 'react-native';

import { MessageState } from '@/components/message-state';
import { PostCard } from '@/components/post-card';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/supabase';
import { deletePost, fetchFeed, setLiked } from '@/services/posts';
import type { FeedPost } from '@/types';

export default function FeedScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setPosts(await fetchFeed(userId));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [userId]);

  // Reload whenever the tab regains focus so new posts/comments show up.
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

  const handleToggleLike = async (post: FeedPost) => {
    const nextLiked = !post.liked_by_me;
    // Optimistic update; reverted if the request fails.
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

  if (posts === null && error === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.tint} />
      </View>
    );
  }

  if (error !== null && posts === null) {
    return (
      <MessageState
        title="Couldn't load the feed"
        detail={error}
        actionTitle="Retry"
        onAction={() => {
          setPosts(null);
          void load();
        }}
      />
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={posts}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <PostCard
          post={item}
          isOwn={item.user_id === userId}
          onToggleLike={handleToggleLike}
          onOpenComments={(p) => router.push(`/post/${p.id}`)}
          onDelete={handleDelete}
        />
      )}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      ListEmptyComponent={
        <MessageState
          title="No posts yet"
          detail="Be the first — create a post from the New post tab."
        />
      }
      contentContainerStyle={posts && posts.length === 0 ? styles.emptyGrow : undefined}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  emptyGrow: {
    flexGrow: 1,
  },
});
