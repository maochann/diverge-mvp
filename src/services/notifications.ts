import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { getCalendars } from 'expo-localization';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { tStatic } from '@/i18n/active';
import type { Locale } from '@/i18n/core';
import { supabase } from '@/lib/supabase';

/**
 * The Daily Prompt reminder is the only notification the app sends, and it
 * is off until the person turns it on in Settings. This module registers the
 * device with the server; the sending happens in the `daily-prompt-notify`
 * Edge Function.
 */

export class NotificationPermissionDenied extends Error {
  constructor() {
    super(tStatic('notify.permissionBody'));
    this.name = 'NotificationPermissionDenied';
  }
}

export const DEFAULT_REMINDER_TIME = '19:00';

export interface ReminderSettings {
  enabled: boolean;
  /** 'HH:MM' local wall-clock time. */
  preferredTime: string;
}

export interface RegisteredDevice extends ReminderSettings {
  token: string;
}

/** The device's IANA time zone, for scheduling at local time. */
export function deviceTimeZone(): string {
  try {
    return getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Ask for permission (only now, never at launch) and return this install's
 * Expo push token. Throws on the simulator or when permission is refused.
 */
export async function obtainPushToken(): Promise<string> {
  if (!Device.isDevice) throw new Error(tStatic('notify.simulator'));

  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!granted && current.canAskAgain) {
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: false },
    });
    granted = asked.granted || asked.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  }
  if (!granted) throw new NotificationPermissionDenied();

  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return data;
}

interface DeviceRow {
  expo_push_token: string;
  enabled: boolean;
  preferred_time: string;
}

function toSettings(row: DeviceRow): RegisteredDevice {
  return {
    token: row.expo_push_token,
    enabled: row.enabled,
    preferredTime: row.preferred_time.slice(0, 5),
  };
}

/** Create or update this device's row on the server. */
export async function registerPushDevice(
  token: string,
  settings: ReminderSettings,
  locale: Locale,
): Promise<RegisteredDevice> {
  const { data, error } = await supabase.rpc('register_push_device', {
    p_token: token,
    p_platform: Platform.OS === 'android' ? 'android' : 'ios',
    p_timezone: deviceTimeZone(),
    p_language: locale,
    p_enabled: settings.enabled,
    p_preferred_time: `${settings.preferredTime}:00`,
  });
  if (error) throw new Error(error.message);
  return toSettings(data as DeviceRow);
}

/** This device's server row, if it has one under the signed-in user. */
export async function fetchPushDevice(token: string): Promise<RegisteredDevice | null> {
  const { data, error } = await supabase
    .from('push_devices')
    .select('expo_push_token, enabled, preferred_time')
    .eq('expo_push_token', token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toSettings(data as DeviceRow) : null;
}

/** Keep the server copy of the app language current so the reminder is sent in it. */
export async function updateDeviceLanguage(token: string, locale: Locale): Promise<void> {
  const { error } = await supabase
    .from('push_devices')
    .update({ app_language: locale, timezone: deviceTimeZone(), last_seen_at: new Date().toISOString() })
    .eq('expo_push_token', token);
  if (error) throw new Error(error.message);
}

/** Forget this device on the server (used when turning the reminder off for good). */
export async function removePushDevice(token: string): Promise<void> {
  const { error } = await supabase.from('push_devices').delete().eq('expo_push_token', token);
  if (error) throw new Error(error.message);
}

/** The deep link carried by a reminder, if the tapped notification was one. */
export function reminderUrlFrom(response: Notifications.NotificationResponse | null): string | null {
  const url = response?.notification.request.content.data?.url;
  if (typeof url !== 'string') return null;
  // Older reminders pointed at the tab; the composer is a sheet now.
  if (url.startsWith('/create')) return url.replace('/create', '/compose');
  return url.startsWith('/compose') ? url : null;
}
