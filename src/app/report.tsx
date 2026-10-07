import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
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
import { Radius, Spacing, Type } from '@/constants/theme';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { REPORT_REASONS, submitReport, type ReportReason } from '@/services/relations';

const MAX_DETAILS = 500;

/**
 * Report a post or a person. Opened as a modal with `postId` or `userId`.
 * Reports go to the developer only; the reported person is never told.
 */
export default function ReportScreen() {
  const { postId, userId: reportedUserId } = useLocalSearchParams<{
    postId?: string;
    userId: string;
  }>();
  const { session } = useAuth();
  const { colors, scheme } = useTheme();
  const t = useT();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const what = postId ? t('report.thisPost') : t('report.thisAccount');
  const canSubmit = reason !== null && !submitting;

  const handleSubmit = async () => {
    if (!session || reason === null || !reportedUserId) return;
    setSubmitting(true);
    try {
      await submitReport(session.user.id, {
        postId,
        userId: reportedUserId,
        reason,
        details: details.trim().length > 0 ? details.trim() : null,
      });
      Alert.alert(t('report.thanksTitle'), t('report.thanksBody'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert(t('report.failed'), errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={[styles.question, { color: colors.text }]}>
          {t('report.question', { what })}
        </Text>

        <View accessibilityRole="radiogroup" style={styles.options}>
          {REPORT_REASONS.map((option) => {
            const active = option.key === reason;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => setReason(option.key)}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: colors.surface,
                    borderColor: active ? colors.tint : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons
                  name={active ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={active ? colors.tint : colors.textTertiary}
                />
                <Text style={[styles.optionLabel, { color: colors.text }]}>{t(option.labelKey)}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          accessibilityLabel={t('report.detailsA11y')}
          value={details}
          onChangeText={(t) => setDetails(t.slice(0, MAX_DETAILS))}
          placeholder={t('report.detailsPlaceholder')}
          placeholderTextColor={colors.textTertiary}
          keyboardAppearance={scheme}
          multiline
          style={[
            styles.details,
            { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        />

        <Text style={[styles.note, { color: colors.textTertiary }]}>
          {t('report.note')}
        </Text>

        <Button title={t('report.send')} onPress={handleSubmit} disabled={!canSubmit} loading={submitting} />
        <Button title={t('common.cancel')} variant="secondary" onPress={() => router.back()} />
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
  question: Type.heading,
  options: {
    gap: Spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  optionLabel: Type.body,
  details: {
    ...Type.body,
    minHeight: 96,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    textAlignVertical: 'top',
  },
  note: Type.caption,
});
