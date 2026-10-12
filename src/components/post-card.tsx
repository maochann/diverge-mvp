import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { ForkLine } from '@/components/fork-line';
import { PostImages } from '@/components/post-images';
import { Motion, Spacing, Type } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { timeAgo } from '@/lib/format';
import { useRelations } from '@/lib/relations-context';
import { errorMessage } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { needsTranslation, targetForLocale, translatePost } from '@/services/translations';
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
  /**
   * Where the post comes from, relative to the reader's circle. 'beyond'
   * shows a small hollow mark before the name (the chapter marker says what
   * it means once); 'circle' shows nothing.
   */
  origin?: 'circle' | 'beyond';
  /** Open the composer to branch from this post. Defaults to the Post tab. */
  onFork?: (post: FeedPost) => void;
  /** Open the post this one branched from. Defaults to its detail screen. */
  onOpenOrigin?: (originId: string) => void;
}

/** The outline heart stays; the filled one soaks in over it like ink. */
function LikeHeart({ liked, color, idleColor }: { liked: boolean; color: string; idleColor: string }) {
  const fill = useSharedValue(liked ? 1 : 0);
  useEffect(() => {
    fill.set(withTiming(liked ? 1 : 0, { duration: liked ? Motion.base : Motion.fast }));
  }, [liked, fill]);
  const fillStyle = useAnimatedStyle(() => ({
    opacity: fill.value,
    transform: [{ scale: 0.9 + 0.1 * fill.value }],
  }));
  return (
    <View style={styles.heart}>
      <Ionicons name="heart-outline" size={20} color={liked ? color : idleColor} />
      <Animated.View style={[StyleSheet.absoluteFill, fillStyle]}>
        <Ionicons name="heart" size={20} color={color} />
      </Animated.View>
    </View>
  );
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
  origin = 'circle',
  onFork,
  onOpenOrigin,
}: PostCardProps) {
  const { colors, scheme } = useTheme();
  const { t, tp, locale } = useI18n();
  const { block, isPending } = useRelations();
  const authorTappable = !isOwn && onOpenAuthor !== undefined;

  // Translation is offered, never applied: one quiet link, and the original
  // is always one tap away.
  const target = targetForLocale(locale);
  const translatable = needsTranslation(post.content, target);
  const [translation, setTranslation] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);

  const toggleTranslation = async () => {
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }
    if (translation !== null) {
      setShowTranslation(true);
      return;
    }
    setTranslating(true);
    try {
      const result = await translatePost(post.id, target);
      setTranslation(result.text);
      setShowTranslation(true);
    } catch (e) {
      Alert.alert(t('post.translateFailed'), errorMessage(e));
    } finally {
      setTranslating(false);
    }
  };
  // Posts cached before multi-photo shipped may lack the array.
  const images = post.image_urls ?? [];
  // Provenance is shown only while the original is visible to this reader.
  const forkOrigin = post.forked_from ?? null;
  const promptText = post.daily_prompt
    ? locale === 'ja'
      ? post.daily_prompt.text_ja
      : post.daily_prompt.text_en
    : null;

  const openOrigin = () => {
    if (!forkOrigin) return;
    if (onOpenOrigin) onOpenOrigin(forkOrigin.id);
    else router.push(`/post/${forkOrigin.id}`);
  };

  const fork = () => {
    if (onFork) onFork(post);
    else router.push({ pathname: '/compose', params: { forkFrom: post.id } });
  };

  const confirmBlock = () => {
    Alert.alert(
      t('block.title', { name: post.author.display_name }),
      t('block.body'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('block.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await block(post.user_id);
              onAuthorBlocked?.(post.user_id);
            } catch (e) {
              Alert.alert(t('block.failed'), errorMessage(e));
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
        label: t('post.reportPost'),
        run: () => router.push(`/report?postId=${post.id}&userId=${post.user_id}`),
      },
      { label: t('post.blockName', { name: post.author.display_name }), destructive: true, run: confirmBlock },
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...actions.map((a) => a.label), t('common.cancel')],
          destructiveButtonIndex: 1,
          cancelButtonIndex: actions.length,
          userInterfaceStyle: scheme,
        },
        (index) => actions[index]?.run(),
      );
    } else {
      Alert.alert(t('post.options'), undefined, [
        ...actions.map((a) => ({
          text: a.label,
          style: a.destructive ? ('destructive' as const) : ('default' as const),
          onPress: a.run,
        })),
        { text: t('common.cancel'), style: 'cancel' as const },
      ]);
    }
  };

  const confirmDelete = () => {
    Alert.alert(t('post.deleteTitle'), t('post.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => onDelete(post) },
    ]);
  };

  return (
    <View style={[styles.post, images.length > 0 && styles.postWithImages]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole={authorTappable ? 'button' : undefined}
          accessibilityLabel={
            authorTappable
              ? `${t('common.openProfile', { name: post.author.display_name })}${
                  origin === 'beyond' ? t('post.fromBeyondA11y') : ''
                }`
              : undefined
          }
          onPress={authorTappable ? () => onOpenAuthor(post.user_id) : undefined}
          disabled={!authorTappable}
          hitSlop={4}
          style={({ pressed }) => [styles.author, pressed && authorTappable && styles.pressed]}
        >
          {origin === 'beyond' ? (
            <View style={[styles.beyondMark, { borderColor: colors.textTertiary }]} />
          ) : null}
          <Avatar url={post.author.avatar_url} name={post.author.display_name} size={28} />
          <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={1}>
            {post.author.display_name}
          </Text>
        </Pressable>
        <Text style={[styles.time, { color: colors.textTertiary }]}>
          {timeAgo(post.created_at)}
        </Text>
      </View>

      {forkOrigin ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('fork.branchedFromA11y', { username: forkOrigin.username })}
          onPress={openOrigin}
          hitSlop={6}
          style={({ pressed }) => [styles.provenance, pressed && styles.pressed]}
        >
          <ForkLine width={16} color={colors.textTertiary} />
          <Text style={[styles.provenanceText, { color: colors.textSecondary }]} numberOfLines={1}>
            {t('fork.branchedFrom', { username: forkOrigin.username })}
          </Text>
        </Pressable>
      ) : null}
      {promptText ? (
        <Text style={[styles.promptLine, { color: colors.textTertiary }]} numberOfLines={2}>
          {t('prompt.provenance')} · “{promptText}”
        </Text>
      ) : null}

      <Text style={[styles.content, { color: colors.text }]}>
        {showTranslation && translation !== null ? translation : post.content}
      </Text>
      {translatable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showTranslation ? t('post.seeOriginal') : t('post.seeTranslation')}
          onPress={() => void toggleTranslation()}
          disabled={translating}
          hitSlop={6}
          style={({ pressed }) => [styles.translateLink, pressed && styles.pressed]}
        >
          <Text style={[styles.translateText, { color: colors.tint }]}>
            {translating ? t('post.translating') : showTranslation ? t('post.seeOriginal') : t('post.seeTranslation')}
          </Text>
        </Pressable>
      ) : null}

      {images.length > 0 ? (
        <View style={styles.images}>
          <PostImages urls={images} />
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={post.liked_by_me ? t('post.unlike') : t('post.like')}
          onPress={() => onToggleLike(post)}
          hitSlop={8}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <LikeHeart liked={post.liked_by_me} color={colors.like} idleColor={colors.textTertiary} />
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
            accessibilityLabel={t('post.viewComments')}
            onPress={() => onOpenComments(post)}
            hitSlop={8}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Ionicons name="chatbubble-outline" size={20} color={colors.textTertiary} />
            <Text style={[styles.actionCount, { color: colors.textTertiary }]}>
              {post.comment_count}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            post.branch_count > 0
              ? `${t('fork.actionA11y')}. ${tp('fork.branches', post.branch_count)}`
              : t('fork.actionA11y')
          }
          onPress={fork}
          hitSlop={8}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Ionicons name="git-branch-outline" size={20} color={colors.textTertiary} />
          {post.branch_count > 0 ? (
            <Text style={[styles.actionCount, { color: colors.textTertiary }]}>
              {post.branch_count}
            </Text>
          ) : null}
        </Pressable>
        <View style={styles.spacer} />
        {isOwn ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('post.deleteA11y')}
            onPress={confirmDelete}
            hitSlop={12}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Ionicons name="trash-outline" size={20} color={colors.textTertiary} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.moreOptions')}
            onPress={openMenu}
            disabled={isPending(post.user_id)}
            hitSlop={12}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  post: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  postWithImages: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  beyondMark: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: StyleSheet.hairlineWidth * 2,
    marginRight: 2,
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
    ...Type.name,
    flexShrink: 1,
  },
  time: {
    ...Type.caption,
    fontVariant: ['tabular-nums'],
  },
  content: Type.body,
  provenance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'flex-start',
    minHeight: 24,
    marginBottom: -2,
  },
  provenanceText: Type.caption,
  promptLine: {
    ...Type.caption,
    marginBottom: -2,
  },
  translateLink: {
    alignSelf: 'flex-start',
    marginTop: -4,
  },
  translateText: Type.caption,
  images: {
    marginTop: 2,
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
  heart: {
    width: 20,
    height: 20,
  },
  spacer: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
