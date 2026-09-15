import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { PostImage } from '@/components/post-image';
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
}

export function PostCard({
  post,
  isOwn,
  onToggleLike,
  onOpenComments,
  onDelete,
  showCommentButton = true,
  onOpenAuthor,
  onAuthorBlocked,
}: PostCardProps) {
  const { colors } = useTheme();
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
          userInterfaceStyle: colors.background === '#ffffff' ? 'light' : 'dark',
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
    <View
      style={[
        styles.card,
        { backgroundColor: colors.background, borderBottomColor: colors.border },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole={authorTappable ? 'button' : undefined}
          accessibilityLabel={authorTappable ? `Open ${post.author.display_name}'s profile` : undefined}
          onPress={authorTappable ? () => onOpenAuthor(post.user_id) : undefined}
          disabled={!authorTappable}
          hitSlop={4}
          style={({ pressed }) => [styles.author, pressed && authorTappable && styles.pressed]}
        >
          <Avatar url={post.author.avatar_url} name={post.author.display_name} />
          <View style={styles.headerText}>
            <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={1}>
              {post.author.display_name}
            </Text>
            <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
              @{post.author.username} · {timeAgo(post.created_at)}
            </Text>
          </View>
        </Pressable>
        {isOwn ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete post"
            onPress={confirmDelete}
            hitSlop={12}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Ionicons name="trash-outline" size={18} color={colors.textTertiary} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More options"
            onPress={openMenu}
            disabled={isPending(post.user_id)}
            hitSlop={12}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>

      <Text style={[styles.content, { color: colors.text }]}>{post.content}</Text>

      {post.image_url ? <PostImage uri={post.image_url} /> : null}

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
            size={22}
            color={post.liked_by_me ? colors.like : colors.textSecondary}
          />
          <Text
            style={[
              styles.actionCount,
              { color: post.liked_by_me ? colors.like : colors.textSecondary },
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
            <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.actionCount, { color: colors.textSecondary }]}>
              {post.comment_count}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    gap: Spacing.md,
  },
  headerText: {
    flex: 1,
  },
  displayName: Type.bodyStrong,
  meta: Type.caption,
  iconButton: {
    padding: Spacing.xs,
  },
  content: Type.body,
  actions: {
    flexDirection: 'row',
    gap: Spacing.xl,
    marginTop: Spacing.xs,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    minHeight: 32,
  },
  actionCount: {
    ...Type.caption,
    fontVariant: ['tabular-nums'],
  },
  pressed: {
    opacity: 0.6,
  },
});
