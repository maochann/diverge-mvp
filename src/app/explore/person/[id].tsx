import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { MessageState } from '@/components/message-state';
import { PostCard } from '@/components/post-card';
import { PostSkeleton } from '@/components/post-skeleton';
import { Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { fetchPost, setLiked } from '@/services/posts';
import type { FeedPost } from '@/types';

/**
 * One person's post, opened from the Explore canvas as a sheet so the space
 * stays underneath. Following happens on their profile, never here.
 */
export default function ExplorePersonSheet() {
  const { id: personId, postId } = useLocalSearchParams<{ id: string; postId: string }>();
  const { session } = useAuth();
  const { colors } = useTheme();
  const viewerId = session?.user.id ?? '';

  const [post, setPost] = useState<FeedPost | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPost(await fetchPost(postId, viewerId));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [postId, viewerId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleToggleLike = async (current: FeedPost) => {
    const nextLiked = !current.liked_by_me;
    setPost({
      ...current,
      liked_by_me: nextLiked,
      like_count: current.like_count + (nextLiked ? 1 : -1),
    });
    try {
      await setLiked(current.id, viewerId, nextLiked);
    } catch (e) {
      setPost(current);
      Alert.alert('Could not update like', errorMessage(e));
    }
  };

  /** Leave the sheet first so the pushed screen sits on the canvas, not the sheet. */
  const goTo = (href: string) => {
    router.back();
    setTimeout(() => router.push(href as never), 250);
  };

  if (error !== null && post === null) {
    return (
      <MessageState
        icon="cloud-offline-outline"
        title="Couldn't load this post"
        detail={error}
        actionTitle="Retry"
        onAction={() => void load()}
      />
    );
  }

  return (
    <ScrollView
      style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]}
      contentContainerStyle={styles.container}
    >
      {post ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${post.author.display_name}'s profile`}
            onPress={() => goTo(`/user/${personId}`)}
            style={({ pressed }) => [
              styles.personRow,
              { borderBottomColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <Avatar url={post.author.avatar_url} name={post.author.display_name} size={44} />
            <View style={styles.personText}>
              <Text style={[styles.personName, { color: colors.text }]} numberOfLines={1}>
                {post.author.display_name}
              </Text>
              <Text style={[styles.personMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                @{post.author.username}
              </Text>
            </View>
            <Text style={[styles.profileLink, { color: colors.tint }]}>View profile</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.tint} />
          </Pressable>

          <PostCard
            post={post}
            isOwn={false}
            onToggleLike={handleToggleLike}
            onOpenComments={(p) => goTo(`/post/${p.id}`)}
            onDelete={() => undefined}
            onAuthorBlocked={() => router.back()}
          />
        </>
      ) : (
        <PostSkeleton withImage />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
  },
  container: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  personText: {
    flex: 1,
    gap: 1,
  },
  personName: Type.bodyStrong,
  personMeta: Type.caption,
  profileLink: Type.captionStrong,
  pressed: {
    opacity: 0.6,
  },
});
