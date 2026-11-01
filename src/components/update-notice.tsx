import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { AppState, Linking, Modal, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { useSerif, useTheme } from '@/lib/theme';
import { updateNeedFor, type UpdateNeed } from '@/lib/version';
import { fetchAppConfig, type AppConfig } from '@/services/app-config';

/** Device-wide: the optional notice for this store version was put aside. */
const DISMISSED_KEY = 'update-dismissed';

/** The version string this build was made with (app.json). */
export function installedVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

/**
 * A quiet word when a newer Diverge is on the App Store, checked at launch
 * and whenever the app comes back to the front. Optional updates can be
 * put aside once per version; a required one (older than the server still
 * supports) stays until the update is installed.
 */
export function UpdateNotice() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const serif = useSerif();
  const [notice, setNotice] = useState<{ need: UpdateNeed; config: AppConfig } | null>(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const config = await fetchAppConfig();
      if (!config || !alive) return;
      const need = updateNeedFor(installedVersion(), config.update);
      if (need === 'optional') {
        const dismissed = await AsyncStorage.getItem(DISMISSED_KEY).catch(() => null);
        if (dismissed === config.update.latest) return;
      }
      if (alive) setNotice(need === 'none' ? null : { need, config });
    };
    void check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  if (!notice) return null;
  const required = notice.need === 'required';
  const later = () => {
    void AsyncStorage.setItem(DISMISSED_KEY, notice.config.update.latest).catch(() => undefined);
    setNotice(null);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={required ? undefined : later}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.title, serif.strong, { color: colors.text }]}>
            {required ? t('update.requiredTitle') : t('update.title')}
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {required
              ? t('update.requiredBody')
              : t('update.body', { version: notice.config.update.latest })}
          </Text>
          <View style={styles.actions}>
            <Button
              title={t('update.open')}
              onPress={() => void Linking.openURL(notice.config.storeUrl)}
            />
            {required ? null : <Button title={t('update.later')} variant="secondary" onPress={later} />}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: Spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  title: Type.title,
  body: Type.body,
  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
});
