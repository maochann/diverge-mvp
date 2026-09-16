import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { PostImages } from '@/components/post-images';
import { Spacing, Type } from '@/constants/theme';
import { timeAgo } from '@/lib/format';
import { useRelations } from '@/lib/relations-context';
import { errorMessage } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import type { FeedPost } from '@/types';

interface PostCardProps {
  post: FeedPost;
  isOwn: boolean;
  onToggleLike: (post: FeedPost) => void;
  onOpenComments: (post: FeedPost) => void;
  onDelete: (post: FeedPost) => void;
  /** Hide the comment button on the post-detail screen. */
  showCommentButton?: boolean;
  /**
   * Open the author's profile. Omitted (or own post) means the header is not
   * tappable — your own profile is a tab, not a destination from a post.
   */
  onOpenAuthor?: (userId: string) => void;
  /**
   * Called after the reader blocks this post's author from the card's menu,
   * so the screen can drop their posts right away.
   */
  onAuthorBlocked?: (userId: string) => void;
  /** One quiet line above the author, e.g. "Outside your circle" in Mix. */
  provenance?: string | null;
}

/**
 * A post as a paragraph, not a card: name and time on one line, the text,
 * the photos, and a faint row of actions. Separation between posts is
 * whitespace; hairlines are saved for chapter boundaries.
 */
export function PostCard({
  post,
  isOwn,
  onToggleLike,
  onOpenComments,
  onDelete,
  showCommentButton = true,
  onOpenAuthor,
  onAuthorBlocked,
  provenance,
}: PostCardProps) {
  const { colors, scheme } = useTheme();
  const { block, isPending } = useRelations();
  const authorTappable = !isOwn && onOpenAuthor !== undefined;

  const confirmBlock = () => {
    Alert.alert(
      `Block ${post.author.display_name}?`,
      "You won't see each other's posts, comments or profiles, and any follows between you are removed. They won't be told.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await block(post.user_id);
              onAuthorBlocked?.(post.user_id);
            } catch (e) {
              Alert.alert('Could not block', errorMessage(e));
            }
          },
        },
      ],
    );
  };

  /** "…" on someone else's post: report it, or block its author. */
  const openMenu = () => {
    const actions: { label: string; destructive?: boolean; run: () => void }[] = [
      {
        label: 'Report post',
        run: () => router.push(`/report?postId=${post.id}&userId=${post.user_id}`),
      },
      { label: `Block ${post.author.display_name}`, destructive: true, run: confirmBlock },
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...actions.map((a) => a.label), 'Cancel'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: actions.length,
          userInterfaceStyle: scheme,
        },
        (index) => actions[index]?.run(),
      );
    } else {
      Alert.alert('Post options', undefined, [
        ...actions.map((a) => ({
          text: a.label,
          style: a.destructive ? ('destructive' as const) : ('default' as const),
          onPress: a.run,
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(post) },
    ]);
  };

  return (
    <View style={styles.post}>
      {provenance ? (
        <Text style={[styles.provenance, { color: colors.tint }]}>{provenance}</Text>
      ) : null}

      <View style={styles.header}>
        <Pressable
          accessibilityRole={authorTappable ? 'button' : undefined}
          accessibilityLabel={
            authorTappable ? `Open ${post.author.display_name}'s profile` : undefined
          }
          onPress={authorTappable ? () => onOpenAuthor(post.user_id) : undefined}
          disabled={!authorTappable}
          hitSlop={4}
          style={({ pressed }) => [styles.author, pressed && authorTappable && styles.pressed]}
        >
          <Avatar url={post.author.avatar_url} name={post.author.display_name} size={28} />
          <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={1}>
            {post.author.display_name}
          </Text>
        </Pressable>
        <Text style={[styles.time, { color: colors.textTertiary }]}>
          {timeAgo(post.created_at)}
        </Text>
      </View>

      <Text style={[styles.content, { color: colors.text }]}>{post.content}</Text>

      {post.image_urls.length > 0 ? (
        <View style={styles.images}>
          <PostImages urls={post.image_urls} />
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={post.liked_by_me ? 'Remove like' : 'Like'}
          onPress={() => onToggleLike(post)}
          hitSlop={8}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Ionicons
            name={post.liked_by_me ? 'heart' : 'heart-outline'}
            size={18}
            color={post.liked_by_me ? colors.like : colors.textTertiary}
          />
          <Text
            style={[
              styles.actionCount,
              { color: post.liked_by_me ? colors.like : colors.textTertiary },
            ]}
          >
            {post.like_count}
          </Text>
        </Pressable>
        {showCommentButton ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View comments"
            onPress={() => onOpenComments(post)}
            hitSlop={8}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Ionicons name="chatbubble-outline" size={17} color={colors.textTertiary} />
            <Text style={[styles.actionCount, { color: colors.textTertiary }]}>
              {post.comment_count}
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.spacer} />
        {isOwn ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete post"
            onPress={confirmDelete}
            hitSlop={12}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Ionicons name="trash-outline" size={17} color={colors.textTertiary} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More options"
            onPress={openMenu}
            disabled={isPending(post.user_id)}
            hitSlop={12}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  post: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm + 2,
  },
  provenance: {
    ...Type.caption,
    marginBottom: -2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  author: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
  },
  displayName: {
    ...Type.bodyStrong,
    flexShrink: 1,
  },
  time: {
    ...Type.caption,
    fontVariant: ['tabular-nums'],
  },
  content: Type.body,
  images: {
    marginTop: Spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
    marginTop: Spacing.xs,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 1,
    minHeight: 32,
  },
  actionCount: {
    ...Type.caption,
    fontVariant: ['tabular-nums'],
  },
  spacer: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
