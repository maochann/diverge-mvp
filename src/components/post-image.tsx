import { Image, type ImageLoadEventData } from 'expo-image';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { ImageRatio, Motion, Radius } from '@/constants/theme';
import { useTheme } from '@/lib/theme';

// Remembered per URL so a card keeps its size when the list re-renders or the
// same post shows on another screen.
const ratioCache = new Map<string, number>();

/**
 * Photos sit in one of three frames — portrait, square, landscape — chosen
 * by the picture's own shape. Three frames read as a layout; free ratios
 * read as clutter.
 */
function frameRatio(width: number, height: number): number {
  if (width <= 0 || height <= 0) return ImageRatio.fallback;
  const r = width / height;
  if (r < 0.9) return ImageRatio.portrait;
  if (r <= 1.15) return ImageRatio.square;
  return ImageRatio.landscape;
}

interface PostImageProps {
  uri: string;
  /** Fill the parent instead of sizing by the picture's own frame (multi-photo pager). */
  fill?: boolean;
}

/** Full-width post image in one of three frames, revealed with a soft dissolve. */
export function PostImage({ uri, fill = false }: PostImageProps) {
  const { colors } = useTheme();
  const [ratio, setRatio] = useState(() => ratioCache.get(uri) ?? ImageRatio.fallback);

  const handleLoad = (event: ImageLoadEventData) => {
    const next = frameRatio(event.source.width, event.source.height);
    ratioCache.set(uri, next);
    if (next !== ratio) setRatio(next);
  };

  return (
    <Image
      source={{ uri }}
      onLoad={fill ? undefined : handleLoad}
      style={[
        fill ? styles.fill : [styles.image, { aspectRatio: ratio }],
        { backgroundColor: colors.surface },
      ]}
      contentFit="cover"
      transition={{ duration: Motion.slow, effect: 'cross-dissolve' }}
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
