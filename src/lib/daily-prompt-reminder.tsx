import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import type { Locale } from '@/i18n/core';
import {
  DEFAULT_REMINDER_TIME,
  obtainPushToken,
  registerPushDevice,
  type RegisteredDevice,
  type ReminderSettings,
  updateDeviceLanguage,
} from '@/services/notifications';

/**
 * What this device last told the server, remembered locally so Settings can
 * show On / Off without a round trip and so a language change can be
 * forwarded. The server row is the truth; this is a cache of it.
 */
const storageKey = (userId: string) => `daily-prompt-reminder:${userId}`;

async function readCache(userId: string): Promise<RegisteredDevice | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RegisteredDevice>;
    if (typeof parsed.token !== 'string') return null;
    return {
      token: parsed.token,
      enabled: parsed.enabled === true,
      preferredTime:
        typeof parsed.preferredTime === 'string' ? parsed.preferredTime : DEFAULT_REMINDER_TIME,
    };
  } catch {
    return null;
  }
}

async function writeCache(userId: string, device: RegisteredDevice): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(device)).catch(() => undefined);
}

/**
 * The welcome tour can turn the reminder on before there is an account.
 * The OS permission is asked there; the server row is created the first
 * time someone signs in on this device.
 */
const PENDING_KEY = 'daily-prompt-reminder:pending';

export async function markReminderWanted(): Promise<void> {
  await AsyncStorage.setItem(PENDING_KEY, '1').catch(() => undefined);
}

export async function applyPendingReminder(userId: string, locale: Locale): Promise<void> {
  try {
    if ((await AsyncStorage.getItem(PENDING_KEY)) !== '1') return;
    const token = await obtainPushToken();
    const saved = await registerPushDevice(
      token,
      { enabled: true, preferredTime: DEFAULT_REMINDER_TIME },
      locale,
    );
    await writeCache(userId, saved);
    await AsyncStorage.removeItem(PENDING_KEY);
  } catch {
    // Permission was withdrawn or the device is a simulator: Settings still works.
  }
}

/** Forward a language change to the server copy, if this device is registered. */
export async function syncReminderLanguage(userId: string, locale: Locale): Promise<void> {
  const cached = await readCache(userId);
  if (!cached) return;
  await updateDeviceLanguage(cached.token, locale).catch(() => undefined);
}

interface Loaded {
  userId: string;
  device: RegisteredDevice | null;
}

/**
 * The reminder as this account has it on this device. `save` asks for
 * notification permission the first time the reminder is turned on (never
 * before), registers the device, and remembers the result.
 */
export function useDailyPromptReminder(userId: string, locale: Locale) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    readCache(userId).then((device) => {
      if (!cancelled) setLoaded({ userId, device });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const device = loaded?.userId === userId ? loaded.device : null;
  const ready = loaded?.userId === userId;
  const settings: ReminderSettings = {
    enabled: device?.enabled ?? false,
    preferredTime: device?.preferredTime ?? DEFAULT_REMINDER_TIME,
  };

  const save = useCallback(
    async (next: ReminderSettings) => {
      setSaving(true);
      try {
        // Turning it off with no registered device is just a local fact.
        if (!next.enabled && !device) {
          return;
        }
        const token = device?.token ?? (await obtainPushToken());
        const saved = await registerPushDevice(token, next, locale);
        await writeCache(userId, saved);
        setLoaded({ userId, device: saved });
      } finally {
        setSaving(false);
      }
    },
    [device, locale, userId],
  );

  return { ready, settings, saving, save };
}
