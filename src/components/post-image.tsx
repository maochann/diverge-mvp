import { Image, type ImageLoadEventData } from 'expo-image';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { ImageRatio, Radius } from '@/constants/theme';
import { useTheme } from '@/lib/theme';

// Remembered per URL so a card keeps its size when the list re-renders or the
// same post shows on another screen.
const ratioCache = new Map<string, number>();

function clampRatio(width: number, height: number): number {
  if (width <= 0 || height <= 0) return ImageRatio.fallback;
  return Math.min(ImageRatio.max, Math.max(ImageRatio.min, width / height));
}

interface PostImageProps {
  uri: string;
  /** Fill the parent instead of sizing by the picture's own ratio (multi-photo pager). */
  fill?: boolean;
}

/** Full-width post image that keeps the picture's own aspect ratio (within limits). */
export function PostImage({ uri, fill = false }: PostImageProps) {
  const { colors } = useTheme();
  const [ratio, setRatio] = useState(() => ratioCache.get(uri) ?? ImageRatio.fallback);

  const handleLoad = (event: ImageLoadEventData) => {
    const next = clampRatio(event.source.width, event.source.height);
    ratioCache.set(uri, next);
    if (next !== ratio) setRatio(next);
  };

  if (fill) {
    return (
      <Image
        source={{ uri }}
        style={[styles.fill, { backgroundColor: colors.surface }]}
        contentFit="cover"
        transition={150}
        accessibilityLabel="Post image"
      />
    );
  }

  return (
    <Image
      source={{ uri }}
      onLoad={handleLoad}
      style={[styles.image, { aspectRatio: ratio, backgroundColor: colors.surface }]}
      contentFit="cover"
      transition={150}
      accessibilityLabel="Post image"
    />
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    borderRadius: Radius.lg,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
});
