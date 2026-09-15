import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { MessageState } from '@/components/message-state';
import { PostCard } from '@/components/post-card';
import { PostSkeleton } from '@/components/post-skeleton';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { timeAgo } from '@/lib/format';
import { errorMessage } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import {
  addComment,
  deleteComment,
  deletePost,
  fetchComments,
  fetchPost,
  setLiked,
} from '@/services/posts';
import type { Comment, FeedPost } from '@/types';

const MAX_COMMENT_LENGTH = 300;

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const userId = session?.user.id ?? '';

  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([fetchPost(id, userId), fetchComments(id)]);
      setPost(p);
      setComments(c);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id, userId]);

  // Load on mount and refresh when the screen regains focus.
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
      await setLiked(current.id, userId, nextLiked);
    } catch (e) {
      setPost(current);
      Alert.alert('Could not update like', errorMessage(e));
    }
  };

  const handleDeletePost = async (current: FeedPost) => {
    try {
      await deletePost(current.id);
      router.back();
    } catch (e) {
      Alert.alert('Could not delete post', errorMessage(e));
    }
  };

  const handleSend = async () => {
    const content = draft.trim();
    if (content.length === 0) return;
    setSending(true);
    try {
      await addComment(id, userId, content);
      setDraft('');
      setComments(await fetchComments(id));
      setPost((p) => (p ? { ...p, comment_count: p.comment_count + 1 } : p));
    } catch (e) {
      Alert.alert('Could not add comment', errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const confirmDeleteComment = (comment: Comment) => {
    Alert.alert('Delete comment?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteComment(comment.id);
            setComments((cur) => (cur ?? []).filter((c) => c.id !== comment.id));
            setPost((p) => (p ? { ...p, comment_count: Math.max(0, p.comment_count - 1) } : p));
          } catch (e) {
            Alert.alert('Could not delete comment', errorMessage(e));
          }
        },
      },
    ]);
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

  if (post === null || comments === null) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <PostSkeleton withImage />
        <ActivityIndicator color={colors.textTertiary} style={styles.spinner} />
      </View>
    );
  }

  const canSend = !sending && draft.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}
    >
      <FlatList
        style={styles.flex}
        data={comments}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <PostCard
              post={post}
              isOwn={post.user_id === userId}
              onToggleLike={handleToggleLike}
              onOpenComments={() => undefined}
              onDelete={handleDeletePost}
              showCommentButton={false}
              onOpenAuthor={(uid) => router.push(`/user/${uid}`)}
              onAuthorBlocked={() => router.back()}
            />
            {comments.length > 0 ? (
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
              </Text>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.comment}>
            <Pressable
              accessibilityRole={item.user_id === userId ? undefined : 'button'}
              accessibilityLabel={
                item.user_id === userId
                  ? undefined
                  : `Open ${item.author.display_name}'s profile`
              }
              onPress={() => router.push(`/user/${item.user_id}`)}
              disabled={item.user_id === userId}
              hitSlop={4}
              style={({ pressed }) => [
                styles.commentAvatar,
                pressed && item.user_id !== userId && styles.pressed,
              ]}
            >
              <Avatar url={item.author.avatar_url} name={item.author.display_name} size={32} />
            </Pressable>
            <View style={styles.commentBody}>
              <Text style={[styles.commentMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                <Text
                  style={[styles.commentName, { color: colors.text }]}
                  onPress={
                    item.user_id === userId
                      ? undefined
                      : () => router.push(`/user/${item.user_id}`)
                  }
                >
                  {item.author.display_name}
                </Text>
                {'  '}@{item.author.username} · {timeAgo(item.created_at)}
              </Text>
              <Text style={[styles.commentText, { color: colors.text }]}>{item.content}</Text>
            </View>
            {item.user_id === userId ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete comment"
                onPress={() => confirmDeleteComment(item)}
                hitSlop={12}
                style={({ pressed }) => [styles.commentDelete, pressed && styles.pressed]}
              >
                <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
              </Pressable>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          <MessageState
            compact
            icon="chatbubble-ellipses-outline"
            title="No comments yet"
            detail="Be the first to reply."
          />
        }
      />

      <View
        style={[
          styles.composer,
          {
            borderTopColor: colors.border,
            backgroundColor: colors.background,
            paddingBottom: Math.max(insets.bottom, Spacing.sm),
          },
        ]}
      >
        <TextInput
          accessibilityLabel="Write a comment"
          value={draft}
          onChangeText={(t) => setDraft(t.slice(0, MAX_COMMENT_LENGTH))}
          placeholder="Write a comment…"
          placeholderTextColor={colors.textTertiary}
          keyboardAppearance={scheme}
          style={[
            styles.input,
            { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          multiline
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send comment"
          onPress={handleSend}
          disabled={!canSend}
          hitSlop={8}
          style={({ pressed }) => [styles.send, pressed && canSend && styles.pressed]}
        >
          {sending ? (
            <ActivityIndicator color={colors.tint} />
          ) : (
            <Ionicons
              name="arrow-up-circle"
              size={32}
              color={canSend ? colors.tint : colors.border}
            />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  spinner: {
    marginTop: Spacing.xl,
  },
  sectionTitle: {
    ...Type.captionStrong,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  comment: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    alignItems: 'flex-start',
  },
  commentAvatar: {
    borderRadius: Radius.full,
  },
  commentBody: {
    flex: 1,
    gap: 2,
  },
  commentMeta: Type.caption,
  commentName: Type.captionStrong,
  commentText: Type.body,
  commentDelete: {
    padding: Spacing.xs,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    ...Type.body,
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.lg + 4,
    paddingHorizontal: Spacing.lg,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 120,
  },
  send: {
    paddingBottom: 2,
  },
  pressed: {
    opacity: 0.6,
  },
});
