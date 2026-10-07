import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
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

import { Button } from '@/components/button';
import { ImageRatio, Radius, Spacing, Type } from '@/constants/theme';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth-context';
import { decisionHaptic } from '@/lib/haptics';
import { errorMessage } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { createPost } from '@/services/posts';
import { pickImages, uploadImage, type PickedImage } from '@/services/storage';

const MAX_LENGTH = 500;
const MAX_PHOTOS = 4;

export default function CreatePostScreen() {
  const { session } = useAuth();
  const { colors, scheme } = useTheme();
  const t = useT();
  const [content, setContent] = useState('');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const canSubmit = content.trim().length > 0 && !submitting;
  const nearLimit = content.length > MAX_LENGTH - 50;

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
      const postId = await createPost(session.user.id, content, imageUrls);
      decisionHaptic();
      setContent('');
      setImages([]);
      // Show the new post itself so the writer sees it landed. Own posts
      // don't appear in Catch up (that's for people you follow), so go via
      // the Feed tab: Back from the post returns to the feed session as it was.
      router.navigate('/');
      router.push(`/post/${postId}`);
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
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          accessibilityLabel={t('create.textA11y')}
          value={content}
          onChangeText={(t) => setContent(t.slice(0, MAX_LENGTH))}
          placeholder={t('create.placeholder')}
          placeholderTextColor={colors.textTertiary}
          keyboardAppearance={scheme}
          multiline
          autoFocus
          style={[styles.textArea, { color: colors.text }]}
        />

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

        <View style={[styles.toolbar, { borderTopColor: colors.border }]}>
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

        <Button
          title={uploadProgress ?? (submitting ? t('create.publishing') : t('create.publish'))}
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
        />
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
  textArea: {
    ...Type.body,
    fontSize: 18,
    lineHeight: 26,
    minHeight: 140,
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
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
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
  pressed: {
    opacity: 0.6,
  },
});
