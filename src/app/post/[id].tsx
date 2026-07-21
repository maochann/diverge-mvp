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

import { Avatar } from '@/components/avatar';
import { MessageState } from '@/components/message-state';
import { PostCard } from '@/components/post-card';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { timeAgo } from '@/lib/format';
import { errorMessage } from '@/lib/supabase';
import {
  addComment,
  deleteComment,
  deletePost,
  fetchComments,
  fetchPost,
  setLiked,
} from '@/services/posts';
import type { Comment, FeedPost } from '@/types';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
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
        title="Couldn't load this post"
        detail={error}
        actionTitle="Retry"
        onAction={() => void load()}
      />
    );
  }

  if (post === null || comments === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.tint} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        style={styles.flex}
        data={comments}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <PostCard
            post={post}
            isOwn={post.user_id === userId}
            onToggleLike={handleToggleLike}
            onOpenComments={() => undefined}
            onDelete={handleDeletePost}
            showCommentButton={false}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.comment}>
            <Avatar url={item.author.avatar_url} name={item.author.display_name} size={32} />
            <View style={styles.commentBody}>
              <Text style={styles.commentMeta}>
                <Text style={styles.commentName}>{item.author.display_name}</Text>
                {'  '}@{item.author.username} · {timeAgo(item.created_at)}
              </Text>
              <Text style={styles.commentText}>{item.content}</Text>
            </View>
            {item.user_id === userId ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete comment"
                onPress={() => confirmDeleteComment(item)}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={16} color={Colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.noComments}>No comments yet — say something.</Text>
        }
      />

      <View style={styles.composer}>
        <TextInput
          accessibilityLabel="Write a comment"
          value={draft}
          onChangeText={(t) => setDraft(t.slice(0, 300))}
          placeholder="Write a comment…"
          placeholderTextColor={Colors.textSecondary}
          style={styles.input}
          multiline
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send comment"
          onPress={handleSend}
          disabled={sending || draft.trim().length === 0}
          style={styles.send}
        >
          {sending ? (
            <ActivityIndicator color={Colors.tint} />
          ) : (
            <Ionicons
              name="send"
              size={20}
              color={draft.trim().length === 0 ? Colors.border : Colors.tint}
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
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comment: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'flex-start',
  },
  commentBody: {
    flex: 1,
    gap: 2,
  },
  commentMeta: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  commentName: {
    fontWeight: '600',
    color: Colors.text,
  },
  commentText: {
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 20,
  },
  noComments: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    padding: Spacing.lg,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: FontSize.md,
    color: Colors.text,
    maxHeight: 100,
  },
  send: {
    padding: Spacing.sm,
  },
});
