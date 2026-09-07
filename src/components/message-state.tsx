import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/lib/theme';

interface MessageStateProps {
  title: string;
  detail?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionTitle?: string;
  onAction?: () => void;
  /** Content-sized (for use inside a list) instead of filling the screen. */
  compact?: boolean;
}

/** Centered empty/error state with an optional icon and action (e.g. Retry). */
export function MessageState({
  title,
  detail,
  icon,
  actionTitle,
  onAction,
  compact = false,
}: MessageStateProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, compact ? styles.compact : styles.fill]}>
      {icon ? <Ionicons name={icon} size={36} color={colors.textTertiary} /> : null}
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {detail ? (
        <Text style={[styles.detail, { color: colors.textSecondary }]}>{detail}</Text>
      ) : null}
      {actionTitle && onAction ? (
        <Button
          title={actionTitle}
          onPress={onAction}
          variant="outline"
          compact
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.sm,
  },
  fill: {
    flex: 1,
    paddingVertical: Spacing.xxl,
  },
  compact: {
    paddingVertical: Spacing.xxl,
  },
  title: {
    ...Type.heading,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  detail: {
    ...Type.body,
    textAlign: 'center',
  },
  action: {
    marginTop: Spacing.sm,
  },
});
