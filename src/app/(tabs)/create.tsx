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
} from 'react-native';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/supabase';
import { createPost } from '@/services/posts';
import { pickImage, uploadImage, type PickedImage } from '@/services/storage';

const MAX_LENGTH = 500;

export default function CreatePostScreen() {
  const { session } = useAuth();
  const [content, setContent] = useState('');
  const [image, setImage] = useState<PickedImage | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = content.trim().length > 0 && !submitting;

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
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <TextField
          label="What's happening?"
          value={content}
          onChangeText={(t) => setContent(t.slice(0, MAX_LENGTH))}
          placeholder="Write something…"
          multiline
          style={styles.textArea}
        />
        <Text style={styles.counter}>
          {content.length}/{MAX_LENGTH}
        </Text>

        {image ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove attached image"
            onPress={() => setImage(null)}
          >
            <Image source={{ uri: image.uri }} style={styles.preview} contentFit="cover" />
            <Text style={styles.removeHint}>Tap image to remove</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={handlePickImage}
            style={styles.addImage}
          >
            <Ionicons name="image-outline" size={20} color={Colors.tint} />
            <Text style={styles.addImageLabel}>Add an image (optional)</Text>
          </Pressable>
        )}

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
    backgroundColor: Colors.background,
  },
  container: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  counter: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
  },
  preview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  removeHint: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  addImage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    borderStyle: 'dashed',
    paddingVertical: Spacing.md,
  },
  addImageLabel: {
    color: Colors.tint,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});
