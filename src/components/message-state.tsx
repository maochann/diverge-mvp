import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Colors, FontSize, Spacing } from '@/constants/theme';

interface MessageStateProps {
  title: string;
  detail?: string;
  actionTitle?: string;
  onAction?: () => void;
}

/** Centered empty/error state with an optional action (e.g. Retry). */
export function MessageState({ title, detail, actionTitle, onAction }: MessageStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      {actionTitle && onAction ? (
        <Button title={actionTitle} onPress={onAction} variant="secondary" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  detail: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  action: {
    marginTop: Spacing.sm,
    alignSelf: 'center',
    minWidth: 120,
  },
});
