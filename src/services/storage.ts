import { decode } from 'base64-arraybuffer';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

export interface PickedImage {
  uri: string;
  base64: string;
  mimeType: string;
}

interface PickImageOptions {
  /** Force a square crop (used for avatars). Posts keep the original framing. */
  square?: boolean;
}

/** Open the photo library and return one image, or null if cancelled. */
export async function pickImage({
  square = false,
}: PickImageOptions = {}): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library access is needed to attach an image.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: square,
    aspect: square ? [1, 1] : undefined,
    quality: 1,
  });
  if (result.canceled) return null;
  return prepareForUpload(result.assets[0]);
}

/** Longest side of an uploaded image, in pixels. Larger photos are scaled down. */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

/**
 * Re-encode the picked photo as a JPEG no larger than MAX_DIMENSION on its
 * longest side. iPhones store photos as HEIC, which the storage buckets
 * reject, and camera originals are several MB — this makes every upload a
 * small JPEG regardless of the source.
 */
async function prepareForUpload(
  asset: ImagePicker.ImagePickerAsset,
): Promise<PickedImage> {
  const context = ImageManipulator.manipulate(asset.uri);
  const longest = Math.max(asset.width, asset.height);
  if (longest > MAX_DIMENSION) {
    if (asset.width >= asset.height) {
      context.resize({ width: MAX_DIMENSION });
    } else {
      context.resize({ height: MAX_DIMENSION });
    }
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: JPEG_QUALITY,
    base64: true,
  });
  rendered.release();
  context.release();
  if (!saved.base64) throw new Error('Could not read the selected image.');
  return { uri: saved.uri, base64: saved.base64, mimeType: 'image/jpeg' };
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
