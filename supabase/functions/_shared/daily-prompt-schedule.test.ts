import { describe, expect, it } from 'vitest';

import {
  SEND_WINDOW_MINUTES,
  dueFor,
  isExpoPushToken,
  localClock,
  notificationBody,
  parseTimeMinutes,
} from './daily-prompt-schedule';

const prompt = { text_en: 'What caught your eye today?', text_ja: '今日、目に留まったものは？' };

describe('localClock', () => {
  it('reads the wall clock in the device zone', () => {
    // 2026-10-06T10:05Z is 19:05 in Tokyo and 03:05 in Vancouver (PDT).
    const now = new Date('2026-10-06T10:05:00Z');
    expect(localClock(now, 'Asia/Tokyo')).toEqual({ date: '2026-10-06', minutes: 19 * 60 + 5 });
    expect(localClock(now, 'America/Vancouver')).toEqual({ date: '2026-10-06', minutes: 3 * 60 + 5 });
  });

  it('crosses the date line correctly', () => {
    const now = new Date('2026-10-06T16:30:00Z');
    expect(localClock(now, 'Asia/Tokyo').date).toBe('2026-10-07');
    expect(localClock(now, 'America/Vancouver').date).toBe('2026-10-06');
  });

  it('handles daylight saving transitions (Vancouver falls back 2026-11-01)', () => {
    // 09:30Z on Nov 1 2026 is 01:30 PST (after fall-back, UTC-8).
    expect(localClock(new Date('2026-11-01T09:30:00Z'), 'America/Vancouver').minutes).toBe(90);
    // 07:30Z the same day is 00:30 PDT (before, UTC-7).
    expect(localClock(new Date('2026-11-01T07:30:00Z'), 'America/Vancouver').minutes).toBe(30);
  });

  it('falls back to UTC for an unknown zone', () => {
    const now = new Date('2026-10-06T10:05:00Z');
    expect(localClock(now, 'Mars/Olympus')).toEqual({ date: '2026-10-06', minutes: 10 * 60 + 5 });
  });
});

describe('dueFor', () => {
  const device = { preferred_time: '19:00:00', timezone: 'Asia/Tokyo', last_daily_prompt_sent_date: null };

  it('is not due before the preferred time', () => {
    expect(dueFor(device, new Date('2026-10-06T09:59:00Z')).due).toBe(false);
  });

  it('is due at and shortly after the preferred time, once', () => {
    expect(dueFor(device, new Date('2026-10-06T10:00:00Z'))).toEqual({ due: true, localDate: '2026-10-06' });
    expect(dueFor(device, new Date('2026-10-06T10:40:00Z')).due).toBe(true);
    const sent = { ...device, last_daily_prompt_sent_date: '2026-10-06' };
    expect(dueFor(sent, new Date('2026-10-06T10:40:00Z')).due).toBe(false);
  });

  it('skips the day entirely once the window has passed (no catch-up, no reminder 2)', () => {
    const late = new Date(Date.UTC(2026, 9, 6, 10, SEND_WINDOW_MINUTES));
    expect(dueFor(device, late).due).toBe(false);
    expect(dueFor(device, new Date('2026-10-06T23:00:00Z')).due).toBe(false);
  });

  it('is due again on the next local day', () => {
    const sent = { ...device, last_daily_prompt_sent_date: '2026-10-06' };
    expect(dueFor(sent, new Date('2026-10-07T10:10:00Z'))).toEqual({ due: true, localDate: '2026-10-07' });
  });

  it('uses the device zone, so two people at 19:00 are due at different instants', () => {
    const vancouver = { ...device, timezone: 'America/Vancouver' };
    expect(dueFor(vancouver, new Date('2026-10-06T10:00:00Z')).due).toBe(false);
    expect(dueFor(vancouver, new Date('2026-10-07T02:00:00Z'))).toEqual({ due: true, localDate: '2026-10-06' });
  });
});

describe('copy and tokens', () => {
  it('uses the app language chosen on the device', () => {
    expect(notificationBody(prompt, 'ja')).toBe('今日、目に留まったものは？');
    expect(notificationBody(prompt, 'en')).toBe('What caught your eye today?');
    expect(notificationBody(prompt, 'fr')).toBe('What caught your eye today?');
  });

  it('parses times defensively', () => {
    expect(parseTimeMinutes('07:30')).toBe(450);
    expect(parseTimeMinutes('19:00:00')).toBe(1140);
    expect(parseTimeMinutes('garbage')).toBe(1140);
  });

  it('recognises Expo push tokens', () => {
    expect(isExpoPushToken('ExponentPushToken[abc-123_XYZ]')).toBe(true);
    expect(isExpoPushToken('ExpoPushToken[abc]')).toBe(true);
    expect(isExpoPushToken('apns:deadbeef')).toBe(false);
  });
});
