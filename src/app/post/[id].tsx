import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
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
import Animated, { FadeIn, FadeInUp, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdjacentPosts } from '@/components/adjacent-posts';
import { Avatar } from '@/components/avatar';
import { MessageState } from '@/components/message-state';
import { PostCard } from '@/components/post-card';
import { PostSkeleton } from '@/components/post-skeleton';
import { Motion, Radius, Spacing, Type } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { ADJACENT_DETAIL_LIMIT } from '@/constants/feed';
import { rankAdjacent, type AdjacentCandidate } from '@/lib/adjacent';
import { useAuth } from '@/lib/auth-context';
import {
  buildThreads,
  composeReplyText,
  liveCount,
  replyTargetFor,
  type CommentThread,
  type ReplyTarget,
} from '@/lib/comment-threads';
import { timeAgo } from '@/lib/format';
import { errorMessage } from '@/lib/supabase';
import { useRelations } from '@/lib/relations-context';
import { useTheme } from '@/lib/theme';
import { fetchAdjacentForPost } from '@/services/adjacent';
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

interface CommentRowProps {
  comment: Comment;
  isOwn: boolean;
  isReply: boolean;
  onReply: (comment: Comment) => void;
  onDelete: (comment: Comment) => void;
}

/** One comment or reply: avatar, name and time, the text, and a quiet Reply. */
function CommentRow({ comment, isOwn, isReply, onReply, onDelete }: CommentRowProps) {
  const { colors } = useTheme();
  const { t } = useI18n();

  if (comment.deleted_at !== null) {
    return (
      <View style={[styles.comment, isReply && styles.reply]}>
        <View style={styles.commentAvatarSpace} />
        <Text style={[styles.commentDeleted, { color: colors.textTertiary }]}>
          {t('comments.deleted')}
        </Text>
      </View>
    );
  }

  const openAuthor = isOwn ? undefined : () => router.push(`/user/${comment.user_id}`);
  return (
    <View style={[styles.comment, isReply && styles.reply]}>
      <Pressable
        accessibilityRole={isOwn ? undefined : 'button'}
        accessibilityLabel={
          isOwn ? undefined : t('common.openProfile', { name: comment.author.display_name })
        }
        onPress={openAuthor}
        disabled={isOwn}
        hitSlop={4}
        style={({ pressed }) => [styles.commentAvatar, pressed && !isOwn && styles.pressed]}
      >
        <Avatar
          url={comment.author.avatar_url}
          name={comment.author.display_name}
          size={isReply ? 26 : 32}
        />
      </Pressable>
      <View style={styles.commentBody}>
        <Text style={[styles.commentMeta, { color: colors.textSecondary }]} numberOfLines={1}>
          <Text style={[styles.commentName, { color: colors.text }]} onPress={openAuthor}>
            {comment.author.display_name}
          </Text>
          {'  '}@{comment.author.username} · {timeAgo(comment.created_at)}
        </Text>
        <Text style={[styles.commentText, { color: colors.text }]}>{comment.content}</Text>
        <View style={styles.commentActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('reply.action')}
            onPress={() => onReply(comment)}
            hitSlop={8}
            style={({ pressed }) => [styles.commentAction, pressed && styles.pressed]}
          >
            <Text style={[styles.commentActionText, { color: colors.textSecondary }]}>
              {t('reply.action')}
            </Text>
          </Pressable>
          {isOwn ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isReply ? t('reply.deleteA11y') : t('comments.deleteA11y')}
              onPress={() => onDelete(comment)}
              hitSlop={8}
              style={({ pressed }) => [styles.commentAction, pressed && styles.pressed]}
            >
              <Ionicons name="trash-outline" size={14} color={colors.textTertiary} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

interface ThreadProps {
  thread: CommentThread;
  userId: string;
  expanded: boolean;
  onToggle: (rootId: string) => void;
  onReply: (comment: Comment) => void;
  onDelete: (comment: Comment) => void;
}

/** A root comment with its replies folded underneath, behind one quiet line. */
function Thread({ thread, userId, expanded, onToggle, onReply, onDelete }: ThreadProps) {
  const { colors } = useTheme();
  const { t, tp } = useI18n();
  const count = thread.replies.length;
  return (
    <View>
      <CommentRow
        comment={thread.root}
        isOwn={thread.root.user_id === userId}
        isReply={false}
        onReply={onReply}
        onDelete={onDelete}
      />
      {count > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? t('reply.hide') : tp('reply.view', count)}
          onPress={() => onToggle(thread.root.id)}
          hitSlop={6}
          style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
        >
          <View style={[styles.toggleRule, { backgroundColor: colors.border }]} />
          <Text style={[styles.toggleText, { color: colors.textSecondary }]}>
            {expanded ? t('reply.hide') : tp('reply.view', count)}
          </Text>
        </Pressable>
      ) : null}
      {expanded && count > 0 ? (
        <Animated.View
          entering={FadeIn.duration(Motion.base)}
          style={[styles.replies, { borderLeftColor: colors.border }]}
        >
          {thread.replies.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              isOwn={reply.user_id === userId}
              isReply
              onReply={onReply}
              onDelete={onDelete}
            />
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { colors, scheme } = useTheme();
  const { t, tp } = useI18n();
  const { sets } = useRelations();
  const insets = useSafeAreaInsets();
  const userId = session?.user.id ?? '';

  const [post, setPost] = useState<FeedPost | null>(null);
  // Neighbours by explicit relation (same prompt, fork graph); null until looked up.
  const [adjacentRaw, setAdjacentRaw] = useState<{ postId: string; items: AdjacentCandidate[] } | null>(null);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const inputRef = useRef<TextInput>(null);

  const threads = useMemo(() => (comments ? buildThreads(comments) : []), [comments]);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([fetchPost(id, userId), fetchComments(id)]);
      setPost(p);
      setComments(c);
      setError(null);
      // Best effort: the post stands on its own if this fails.
      fetchAdjacentForPost(p, userId)
        .then((items) => setAdjacentRaw({ postId: p.id, items }))
        .catch(() => setAdjacentRaw({ postId: p.id, items: [] }));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id, userId]);

  const adjacent = useMemo(() => {
    if (!adjacentRaw || adjacentRaw.postId !== id || !sets) return [];
    return rankAdjacent(adjacentRaw.items, {
      viewerId: userId,
      subjectId: id,
      following: sets.following,
      muted: sets.muted,
      limit: ADJACENT_DETAIL_LIMIT,
    });
  }, [adjacentRaw, id, sets, userId]);

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
      Alert.alert(t('feed.likeFailed'), errorMessage(e));
    }
  };

  const handleDeletePost = async (current: FeedPost) => {
    try {
      await deletePost(current.id);
      router.back();
    } catch (e) {
      Alert.alert(t('feed.deleteFailed'), errorMessage(e));
    }
  };

  const startReply = (comment: Comment) => {
    setReplyTo(replyTargetFor(comment));
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    const content = replyTo ? composeReplyText(draft, replyTo) : draft.trim();
    if (content.length === 0) return;
    setSending(true);
    try {
      await addComment(id, userId, content, replyTo?.rootId ?? null);
      const fresh = await fetchComments(id);
      setDraft('');
      if (replyTo) setExpanded((s) => new Set([...s, replyTo.rootId]));
      setReplyTo(null);
      setComments(fresh);
      setPost((p) => (p ? { ...p, comment_count: liveCount(fresh) } : p));
    } catch (e) {
      Alert.alert(t('comments.addFailed'), errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const confirmDeleteComment = (comment: Comment) => {
    const isReply = comment.parent_comment_id !== null;
    Alert.alert(isReply ? t('reply.deleteTitle') : t('comments.deleteTitle'), t('comments.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteComment(comment.id);
            // The database decides between removing and leaving a tombstone.
            const fresh = await fetchComments(id);
            setComments(fresh);
            setPost((p) => (p ? { ...p, comment_count: liveCount(fresh) } : p));
          } catch (e) {
            Alert.alert(t('comments.deleteFailed'), errorMessage(e));
          }
        },
      },
    ]);
  };

  const toggleThread = (rootId: string) => {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(rootId)) next.delete(rootId);
      else next.add(rootId);
      return next;
    });
  };

  if (error !== null && post === null) {
    return (
      <MessageState
        icon="cloud-offline-outline"
        title={t('post.loadFailed')}
        detail={error}
        actionTitle={t('common.retry')}
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
  const commentTotal = liveCount(comments);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}
    >
      <FlatList
        style={styles.flex}
        data={threads}
        keyExtractor={(item) => item.root.id}
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
            <AdjacentPosts candidates={adjacent} />
            {commentTotal > 0 ? (
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {tp('comments.count', commentTotal)}
              </Text>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <Thread
            thread={item}
            userId={userId}
            expanded={expanded.has(item.root.id)}
            onToggle={toggleThread}
            onReply={startReply}
            onDelete={confirmDeleteComment}
          />
        )}
        ListEmptyComponent={
          <MessageState
            compact
            icon="chatbubble-ellipses-outline"
            title={t('comments.empty.title')}
            detail={t('comments.empty.detail')}
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
        {replyTo ? (
          <Animated.View
            entering={FadeInUp.duration(Motion.fast).withInitialValues({
              transform: [{ translateY: 4 }],
            })}
            exiting={FadeOut.duration(Motion.fast)}
            style={styles.replyBar}
          >
            <Text style={[styles.replyBarText, { color: colors.textSecondary }]} numberOfLines={1}>
              {t('reply.replyingTo', { username: replyTo.username })}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('reply.cancelA11y')}
              onPress={() => setReplyTo(null)}
              hitSlop={10}
              style={({ pressed }) => [styles.replyBarClose, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          </Animated.View>
        ) : null}
        <View style={styles.composerRow}>
          <TextInput
            ref={inputRef}
            accessibilityLabel={replyTo ? t('reply.writeA11y') : t('comments.writeA11y')}
            value={draft}
            onChangeText={(v) => setDraft(v.slice(0, MAX_COMMENT_LENGTH))}
            placeholder={replyTo ? t('reply.write') : t('comments.write')}
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
            accessibilityLabel={replyTo ? t('reply.send') : t('comments.send')}
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
  reply: {
    paddingLeft: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  commentAvatar: {
    borderRadius: Radius.full,
  },
  commentAvatarSpace: {
    width: 32,
  },
  commentBody: {
    flex: 1,
    gap: 2,
  },
  commentMeta: Type.caption,
  commentName: Type.captionStrong,
  commentText: Type.body,
  commentDeleted: {
    ...Type.body,
    flex: 1,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginTop: 2,
  },
  commentAction: {
    minHeight: 28,
    justifyContent: 'center',
  },
  commentActionText: Type.captionStrong,
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingLeft: Spacing.lg + 32 + Spacing.md,
    paddingRight: Spacing.lg,
    minHeight: 32,
  },
  toggleRule: {
    width: 16,
    height: 1,
  },
  toggleText: Type.caption,
  replies: {
    marginLeft: Spacing.lg + 16,
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingBottom: Spacing.xs,
  },
  composer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.xs,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
    minHeight: 24,
  },
  replyBarText: {
    ...Type.caption,
    flex: 1,
  },
  replyBarClose: {
    padding: 2,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
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
