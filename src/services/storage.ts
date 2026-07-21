import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

export interface PickedImage {
  uri: string;
  base64: string;
  mimeType: string;
}

/** Open the photo library and return one image, or null if cancelled. */
export async function pickImage(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library access is needed to attach an image.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.7,
    base64: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset.base64) throw new Error('Could not read the selected image.');
  return {
    uri: asset.uri,
    base64: asset.base64,
    mimeType: asset.mimeType ?? 'image/jpeg',
  };
}

/**
 * Upload an image under the user's own folder (RLS requires the first path
 * segment to be the uploader's id) and return its public URL.
 */
export async function uploadImage(
  bucket: 'avatars' | 'post-images',
  userId: string,
  image: PickedImage,
): Promise<string> {
  const extension = image.mimeType.split('/')[1] ?? 'jpg';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, decode(image.base64), { contentType: image.mimeType });
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
