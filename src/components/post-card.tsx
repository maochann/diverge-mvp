import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { timeAgo } from '@/lib/format';
import type { FeedPost } from '@/types';

interface PostCardProps {
  post: FeedPost;
  isOwn: boolean;
  onToggleLike: (post: FeedPost) => void;
  onOpenComments: (post: FeedPost) => void;
  onDelete: (post: FeedPost) => void;
  /** Hide the comment button on the post-detail screen. */
  showCommentButton?: boolean;
}

export function PostCard({
  post,
  isOwn,
  onToggleLike,
  onOpenComments,
  onDelete,
  showCommentButton = true,
}: PostCardProps) {
  const confirmDelete = () => {
    Alert.alert('Delete post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(post) },
    ]);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Avatar url={post.author.avatar_url} name={post.author.display_name} />
        <View style={styles.headerText}>
          <Text style={styles.displayName}>{post.author.display_name}</Text>
          <Text style={styles.meta}>
            @{post.author.username} · {timeAgo(post.created_at)}
          </Text>
        </View>
        {isOwn ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete post"
            onPress={confirmDelete}
            hitSlop={8}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.content}>{post.content}</Text>

      {post.image_url ? (
        <Image
          source={{ uri: post.image_url }}
          style={styles.image}
          contentFit="cover"
          accessibilityLabel="Post image"
        />
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={post.liked_by_me ? 'Remove like' : 'Like'}
          onPress={() => onToggleLike(post)}
          style={styles.action}
          hitSlop={8}
        >
          <Ionicons
            name={post.liked_by_me ? 'heart' : 'heart-outline'}
            size={22}
            color={post.liked_by_me ? Colors.danger : Colors.textSecondary}
          />
          <Text style={styles.actionCount}>{post.like_count}</Text>
        </Pressable>
        {showCommentButton ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View comments"
            onPress={() => onOpenComments(post)}
            style={styles.action}
            hitSlop={8}
          >
            <Ionicons name="chatbubble-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.actionCount}>{post.comment_count}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  displayName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  meta: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  content: {
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 21,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  actionCount: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
});
