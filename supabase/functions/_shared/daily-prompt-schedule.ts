// Pure scheduling rules for the Daily Prompt reminder. Shared between the
// Edge Function (Deno) and the unit tests (Node); nothing here touches a
// database or the network.

export interface DeviceSchedule {
  /** 'HH:MM' or 'HH:MM:SS', local wall-clock time. */
  preferred_time: string;
  /** IANA zone, e.g. 'Asia/Tokyo'. Unknown zones fall back to UTC. */
  timezone: string;
  /** The device's local date of the last reminder, 'YYYY-MM-DD' or null. */
  last_daily_prompt_sent_date: string | null;
}

/**
 * How long after the preferred time a reminder may still go out. Beyond
 * this the day is simply skipped: the app does not chase anyone.
 */
export const SEND_WINDOW_MINUTES = 90;

export interface LocalClock {
  /** 'YYYY-MM-DD' in the zone. */
  date: string;
  /** Minutes since local midnight. */
  minutes: number;
}

/** The wall clock in a time zone. DST is handled by Intl, not by hand. */
export function localClock(now: Date, timeZone: string): LocalClock {
  let zone = timeZone;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
  } catch {
    zone = 'UTC';
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const hour = Number(get('hour')) % 24;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: hour * 60 + Number(get('minute')),
  };
}

export function parseTimeMinutes(time: string): number {
  const [h, m] = time.split(':').map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 19 * 60;
  return Math.max(0, Math.min(23, h)) * 60 + Math.max(0, Math.min(59, m));
}

export interface Due {
  due: boolean;
  /** The device's local date the reminder would be for. */
  localDate: string;
}

/**
 * Whether a device should get its reminder now: the local clock is inside
 * the window after the preferred time, and nothing has been sent for this
 * local date yet. Called every few minutes by the scheduler; idempotent
 * because the date is recorded before sending.
 */
export function dueFor(device: DeviceSchedule, now: Date): Due {
  const clock = localClock(now, device.timezone);
  const preferred = parseTimeMinutes(device.preferred_time);
  const since = clock.minutes - preferred;
  const inWindow = since >= 0 && since < SEND_WINDOW_MINUTES;
  const alreadySent = device.last_daily_prompt_sent_date === clock.date;
  return { due: inWindow && !alreadySent, localDate: clock.date };
}

export type Language = 'en' | 'ja';

export interface PromptText {
  text_en: string;
  text_ja: string;
}

/** The notification body is the prompt itself, in the device's app language. */
export function notificationBody(prompt: PromptText, language: string): string {
  return language === 'ja' ? prompt.text_ja : prompt.text_en;
}

/** Expo push tokens look like ExponentPushToken[xxxx] (or ExpoPushToken[...]). */
export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(token);
}
