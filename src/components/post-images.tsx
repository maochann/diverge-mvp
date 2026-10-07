import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { FlatList } from 'react-native';

import { PostImage } from '@/components/post-image';
import { ImageRatio, Radius, Spacing, Type } from '@/constants/theme';
import { useT } from '@/i18n';
import { useTheme } from '@/lib/theme';

interface PostImagesProps {
  urls: string[];
}

/**
 * One photo keeps its own aspect ratio. Two to four photos page
 * horizontally at a fixed 4:3, with a quiet "2 / 4" counter rather than dots.
 */
export function PostImages({ urls }: PostImagesProps) {
  const { colors } = useTheme();
  const t = useT();
  const { width: windowWidth } = useWindowDimensions();
  const [page, setPage] = useState(0);

  if (urls.length === 0) return null;
  if (urls.length === 1) return <PostImage uri={urls[0]} />;

  // The card has Spacing.lg padding on both sides.
  const width = windowWidth - Spacing.lg * 2;
  const height = Math.round(width / ImageRatio.fallback);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  };

  return (
    <View style={[styles.frame, { width, height, backgroundColor: colors.surface }]}>
      <FlatList
        data={urls}
        keyExtractor={(uri, index) => `${index}-${uri}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        renderItem={({ item }) => (
          <View style={{ width, height }}>
            <PostImage uri={item} fill />
          </View>
        )}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      />
      <View style={[styles.counter, { backgroundColor: colors.background }]}>
        <Text style={[styles.counterText, { color: colors.textSecondary }]}>
          {t('post.imageCounter', { current: page + 1, total: urls.length })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  counter: {
    position: 'absolute',
    right: Spacing.sm,
    bottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    opacity: 0.9,
  },
  counterText: {
    ...Type.caption,
    fontVariant: ['tabular-nums'],
  },
});
