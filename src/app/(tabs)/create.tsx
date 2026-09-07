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
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { createPost } from '@/services/posts';
import { pickImage, uploadImage, type PickedImage } from '@/services/storage';

const MAX_LENGTH = 500;

export default function CreatePostScreen() {
  const { session } = useAuth();
  const { colors, scheme } = useTheme();
  const [content, setContent] = useState('');
  const [image, setImage] = useState<PickedImage | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = content.trim().length > 0 && !submitting;
  const nearLimit = content.length > MAX_LENGTH - 50;

  const handlePickImage = async () => {
    try {
      const picked = await pickImage();
      if (picked) setImage(picked);
    } catch (e) {
      Alert.alert('Could not open photos', errorMessage(e));
    }
  };

  const handleSubmit = async () => {
    if (!session) return;
    setSubmitting(true);
    try {
      let imageUrl: string | null = null;
      if (image) {
        imageUrl = await uploadImage('post-images', session.user.id, image);
      }
      await createPost(session.user.id, content, imageUrl);
      setContent('');
      setImage(null);
      router.navigate('/');
    } catch (e) {
      Alert.alert('Could not publish post', errorMessage(e));
    } finally {
      setSubmitting(false);
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
          accessibilityLabel="Post text"
          value={content}
          onChangeText={(t) => setContent(t.slice(0, MAX_LENGTH))}
          placeholder="What's happening?"
          placeholderTextColor={colors.textTertiary}
          keyboardAppearance={scheme}
          multiline
          autoFocus
          style={[styles.textArea, { color: colors.text }]}
        />

        {image ? (
          <View>
            <Image
              source={{ uri: image.uri }}
              style={[styles.preview, { backgroundColor: colors.surface }]}
              contentFit="cover"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove attached image"
              onPress={() => setImage(null)}
              hitSlop={8}
              style={styles.removeButton}
            >
              <Ionicons name="close-circle" size={28} color="#ffffff" />
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.toolbar, { borderTopColor: colors.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={image ? 'Replace image' : 'Add an image'}
            onPress={handlePickImage}
            hitSlop={8}
            style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
          >
            <Ionicons name="image-outline" size={24} color={colors.tint} />
            <Text style={[styles.toolLabel, { color: colors.tint }]}>
              {image ? 'Replace photo' : 'Add photo'}
            </Text>
          </Pressable>
          <Text
            style={[
              styles.counter,
              { color: nearLimit ? colors.danger : colors.textTertiary },
            ]}
          >
            {content.length}/{MAX_LENGTH}
          </Text>
        </View>

        <Button
          title={submitting ? 'Publishing…' : 'Publish'}
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
  preview: {
    width: '100%',
    aspectRatio: ImageRatio.fallback,
    borderRadius: Radius.lg,
  },
  removeButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
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
