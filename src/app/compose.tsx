import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { ForkLine } from '@/components/fork-line';
import { Button } from '@/components/button';
import { ImageRatio, Motion, Radius, Spacing, Type } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { useAuth } from '@/lib/auth-context';
import { lastTab } from '@/lib/last-tab';
import { decisionHaptic, successHaptic } from '@/lib/haptics';
import { errorMessage } from '@/lib/supabase';
import { useSerif, useTheme } from '@/lib/theme';
import { createPost, fetchPost } from '@/services/posts';
import { fetchDailyPrompt } from '@/services/prompts';
import { pickImages, uploadImage, type PickedImage } from '@/services/storage';
import type { DailyPromptRef, FeedPost } from '@/types';

const MAX_LENGTH = 500;
const MAX_PHOTOS = 4;

type ForkState = { status: 'loading' } | { status: 'ready'; post: FeedPost } | { status: 'unavailable' };

/**
 * New post, raised as a sheet over wherever the reader was. Cancel and
 * Publish live in the sheet's header so the way out is always visible even
 * with the keyboard up. Two optional starting points sit above the text,
 * both quiet and both dismissable: the day's prompt (one small reason to
 * write), and the post this one branches from (a Fork). Neither is required.
 */
export default function ComposeScreen() {
  const { forkFrom, prompt: promptParam } = useLocalSearchParams<{
    forkFrom?: string;
    prompt?: string;
  }>();
  const { session } = useAuth();
  const { colors, scheme } = useTheme();
  const { t, locale } = useI18n();
  const serif = useSerif();
  const userId = session?.user.id ?? '';

  const [content, setContent] = useState('');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const [forkLoaded, setForkLoaded] = useState<{ id: string; state: ForkState } | null>(null);
  const [forkDismissed, setForkDismissed] = useState(false);
  const [prompt, setPrompt] = useState<DailyPromptRef | null>(null);
  // Null until the writer decides. The prompt is the starting point: it is
  // selected unless the writer dismisses it (or is branching from a post).
  const [promptChoice, setPromptChoice] = useState<boolean | null>(null);

  const forkId = forkFrom && forkFrom.length > 0 && !forkDismissed ? forkFrom : null;
  // Derived, so a stale load for a different original never shows.
  const fork: ForkState | null = forkId
    ? forkLoaded?.id === forkId
      ? forkLoaded.state
      : { status: 'loading' }
    : null;
  const usePrompt = promptChoice ?? (promptParam === 'today' || forkId === null);

  // The original of a fork, as far as the writer can see it.
  useEffect(() => {
    if (!forkId) return;
    let cancelled = false;
    fetchPost(forkId, userId)
      .then((post) => {
        if (!cancelled) setForkLoaded({ id: forkId, state: { status: 'ready', post } });
      })
      .catch(() => {
        if (!cancelled) setForkLoaded({ id: forkId, state: { status: 'unavailable' } });
      });
    return () => {
      cancelled = true;
    };
  }, [forkId, userId]);

  // Today's prompt, fetched each time the tab is opened (it changes at midnight).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchDailyPrompt()
        .then((p) => {
          if (!cancelled) setPrompt(p);
        })
        .catch(() => {
          // The prompt is an offer, not a requirement; posting works without it.
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  /**
   * Close the sheet. The Post tab underneath regains focus and sends the
   * reader back to the place they came from (see (tabs)/create.tsx).
   */
  const close = useCallback(() => {
    if (router.canDismiss()) router.dismiss();
    else router.navigate(lastTab());
  }, []);

  // Words or a photo: either is a post.
  const canSubmit =
    (content.trim().length > 0 || images.length > 0) && !submitting && fork?.status !== 'loading';
  const nearLimit = content.length > MAX_LENGTH - 50;
  const promptText = prompt ? (locale === 'ja' ? prompt.text_ja : prompt.text_en) : null;

  const handlePickImages = async () => {
    const room = MAX_PHOTOS - images.length;
    if (room <= 0) return;
    try {
      const picked = await pickImages(room);
      if (picked.length > 0) setImages((current) => [...current, ...picked].slice(0, MAX_PHOTOS));
    } catch (e) {
      Alert.alert(t('create.photosFailed'), errorMessage(e));
    }
  };

  const removeImage = (index: number) => {
    setImages((current) => current.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!session) return;
    setSubmitting(true);
    try {
      const imageUrls: string[] = [];
      for (const [index, image] of images.entries()) {
        if (images.length > 1) setUploadProgress(t('create.uploading', { n: index + 1, total: images.length }));
        imageUrls.push(await uploadImage('post-images', session.user.id, image));
      }
      setUploadProgress(null);
      const forkedFromPostId = fork?.status === 'ready' ? fork.post.id : null;
      const postId = await createPost(session.user.id, content, imageUrls, {
        forkedFromPostId,
        dailyPromptId: usePrompt && prompt ? prompt.id : null,
      });
      // Taking a thought somewhere new is a slightly bigger moment than a post.
      if (forkedFromPostId) successHaptic();
      else decisionHaptic();
      setContent('');
      setImages([]);
      setPromptChoice(null);
      // The sheet becomes the new post's detail, so the writer sees it
      // landed; Back from there returns to the place they came from.
      router.replace(`/post/${postId}`);
    } catch (e) {
      Alert.alert(t('create.publishFailed'), errorMessage(e));
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <Stack.Screen
        options={{
          title: t('tab.newPost'),
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
              onPress={close}
              disabled={submitting}
              hitSlop={10}
              style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
            >
              <Text style={[styles.headerButtonText, { color: colors.text }]}>{t('common.cancel')}</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('create.publish')}
              accessibilityState={{ disabled: !canSubmit, busy: submitting }}
              onPress={handleSubmit}
              disabled={!canSubmit}
              hitSlop={10}
              style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
            >
              <Text
                style={[
                  styles.headerButtonText,
                  styles.headerPublish,
                  { color: canSubmit ? colors.tint : colors.textTertiary },
                ]}
              >
                {submitting ? t('create.publishing') : t('create.publish')}
              </Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {promptText && prompt ? (
          <View style={[styles.prompt, { borderColor: colors.border }]}>
            <View style={styles.promptHeader}>
              <Text style={[styles.promptLabel, { color: colors.textTertiary }]}>
                {usePrompt ? t('prompt.using') : t('prompt.title')}
              </Text>
              {usePrompt ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('prompt.removeA11y')}
                  onPress={() => setPromptChoice(false)}
                  hitSlop={10}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <Ionicons name="close" size={18} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </View>
            <Text style={[styles.promptText, serif.regular, { color: colors.text }]}>{promptText}</Text>
            {usePrompt ? null : (
              <View style={styles.promptActions}>
                <Button
                  title={t('prompt.use')}
                  variant="outline"
                  compact
                  onPress={() => setPromptChoice(true)}
                />
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={t('prompt.roomA11y')}
                  onPress={() => router.push(`/prompt/${prompt.id}`)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.promptRoom, pressed && styles.pressed]}
                >
                  <Text style={[styles.promptRoomText, { color: colors.tint }]}>{t('prompt.room')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : null}

        {fork ? (
          <Animated.View
            entering={FadeIn.duration(Motion.base)}
            exiting={FadeOut.duration(Motion.fast)}
            style={[styles.fork, { borderColor: colors.border }]}
          >
            <View style={styles.forkHeader}>
              <ForkLine width={20} color={colors.tint} />
              <Text style={[styles.forkLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                {fork.status === 'ready'
                  ? t('fork.composerFrom', { username: fork.post.author.username })
                  : fork.status === 'loading'
                    ? ''
                    : t('fork.composerUnavailable')}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('fork.removeA11y')}
                onPress={() => setForkDismissed(true)}
                hitSlop={10}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            {fork.status === 'ready' ? (
              <>
                <Text style={[styles.forkExcerpt, { color: colors.textSecondary }]} numberOfLines={3}>
                  {fork.post.content}
                </Text>
                <Text style={[styles.forkTitle, serif.regular, { color: colors.text }]}>{t('fork.composerTitle')}</Text>
              </>
            ) : null}
          </Animated.View>
        ) : null}

        <View style={[styles.pickerRow]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={images.length === 0 ? t('create.addPhotos') : t('create.addMorePhotos')}
            onPress={handlePickImages}
            disabled={images.length >= MAX_PHOTOS}
            hitSlop={8}
            style={({ pressed }) => [
              styles.tool,
              (pressed || images.length >= MAX_PHOTOS) && styles.pressed,
            ]}
          >
            <Ionicons name="images-outline" size={24} color={colors.tint} />
            <Text style={[styles.toolLabel, { color: colors.tint }]}>
              {images.length === 0
                ? t('create.addPhotos')
                : images.length >= MAX_PHOTOS
                  ? t('create.photosMax', { max: MAX_PHOTOS })
                  : t('create.addMore', { n: images.length, max: MAX_PHOTOS })}
            </Text>
          </Pressable>
          {nearLimit ? (
            <Text style={[styles.counter, { color: colors.danger }]}>
              {MAX_LENGTH - content.length}
            </Text>
          ) : null}
        </View>

        {images.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbs}
          >
            {images.map((image, index) => (
              <View key={`${index}-${image.uri}`} style={styles.thumbWrap}>
                <Image
                  source={{ uri: image.uri }}
                  style={[styles.thumb, { backgroundColor: colors.surface }]}
                  contentFit="cover"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('create.removePhoto', { n: index + 1 })}
                  onPress={() => removeImage(index)}
                  hitSlop={8}
                  style={styles.removeButton}
                >
                  <Ionicons name="close-circle" size={24} color="#ffffff" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <TextInput
          accessibilityLabel={t('create.textA11y')}
          value={content}
          onChangeText={(v) => setContent(v.slice(0, MAX_LENGTH))}
          placeholder={
            fork?.status === 'ready'
              ? t('fork.placeholder')
              : usePrompt && promptText
                ? t('create.placeholderOptional')
                : t('create.placeholder')
          }
          placeholderTextColor={colors.textTertiary}
          keyboardAppearance={scheme}
          multiline
          // The keyboard waits: a photo is the first thing, words are optional.
          autoFocus={fork?.status === 'ready'}
          style={[styles.textArea, { color: colors.text }]}
        />


        {uploadProgress ? (
          <Text style={[styles.progress, { color: colors.textSecondary }]}>{uploadProgress}</Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  prompt: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  promptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 20,
  },
  promptLabel: {
    ...Type.captionStrong,
    letterSpacing: 0.3,
  },
  promptText: {
    ...Type.chapter,
    fontSize: 18,
    lineHeight: 24,
  },
  promptActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginTop: Spacing.xs,
  },
  promptRoom: {
    minHeight: 34,
    justifyContent: 'center',
  },
  promptRoomText: Type.captionStrong,
  fork: {
    borderLeftWidth: 1,
    paddingLeft: Spacing.md,
    gap: Spacing.xs,
  },
  forkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 24,
  },
  forkLabel: {
    ...Type.caption,
    flex: 1,
  },
  forkExcerpt: Type.caption,
  forkTitle: {
    ...Type.chapter,
    fontSize: 18,
    lineHeight: 24,
    marginTop: Spacing.xs,
  },
  textArea: {
    ...Type.body,
    fontSize: 18,
    lineHeight: 26,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  thumbs: {
    gap: Spacing.sm,
  },
  thumbWrap: {
    width: 120,
    aspectRatio: ImageRatio.fallback,
  },
  thumb: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.md,
  },
  removeButton: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 36,
  },
  toolLabel: Type.captionStrong,
  counter: {
    ...Type.caption,
    fontVariant: ['tabular-nums'],
  },
  headerButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  headerButtonText: Type.body,
  headerPublish: {
    fontWeight: '600',
  },
  progress: {
    ...Type.caption,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
