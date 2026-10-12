// Sends the Daily Prompt reminder: at most one notification per device per
// local day, only to devices whose owner turned the reminder on, with the
// day's prompt as the whole message. Nothing else is ever sent from here.
//
// Called by a scheduler (pg_cron + pg_net, every 10-15 minutes) with the
// shared secret; see docs/daily-prompt-notifications.md. Idempotent: the
// device's local date is claimed in the database before the push goes out,
// so overlapping runs cannot double-send.
//
// Secrets: DAILY_PROMPT_CRON_SECRET (required), EXPO_ACCESS_TOKEN (optional,
// for Expo's enhanced push security).
// Deploy: npx supabase functions deploy daily-prompt-notify --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  dueFor,
  isExpoPushToken,
  notificationBody,
} from '../_shared/daily-prompt-schedule.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100;

interface DeviceRow {
  id: string;
  expo_push_token: string;
  preferred_time: string;
  timezone: string;
  app_language: string;
  last_daily_prompt_sent_date: string | null;
}

interface PromptRow {
  id: string;
  text_en: string;
  text_ja: string;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const cronSecret = Deno.env.get('DAILY_PROMPT_CRON_SECRET');
  const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (!url || !serviceKey) return json({ error: 'function not configured' }, 500);
  if (!cronSecret) return json({ error: 'DAILY_PROMPT_CRON_SECRET is not set' }, 503);

  // Only the scheduler may call this; user input is never trusted here.
  const provided = req.headers.get('x-cron-secret') ?? '';
  if (!timingSafeEqual(provided, cronSecret)) return json({ error: 'forbidden' }, 403);

  const admin = createClient(url, serviceKey);
  const now = new Date();

  const { data: devices, error: devicesError } = await admin
    .from('push_devices')
    .select('id, expo_push_token, preferred_time, timezone, app_language, last_daily_prompt_sent_date')
    .eq('enabled', true)
    .is('invalid_at', null);
  if (devicesError) return json({ error: devicesError.message }, 500);

  const due = (devices as DeviceRow[]).flatMap((d) => {
    const result = dueFor(d, now);
    return result.due && isExpoPushToken(d.expo_push_token) ? [{ device: d, localDate: result.localDate }] : [];
  });

  const summary = { checked: devices?.length ?? 0, due: due.length, sent: 0, skipped: 0, invalidated: 0, errors: 0 };
  if (due.length === 0) return json({ ok: true, ...summary });

  // One prompt per local date (people in different zones may be on different days).
  const prompts = new Map<string, PromptRow>();
  for (const localDate of new Set(due.map((d) => d.localDate))) {
    const { data, error } = await admin.rpc('daily_prompt_for', { p_date: localDate });
    if (error) {
      console.error('daily_prompt_for failed', localDate, error.message);
      continue;
    }
    const row = (data as PromptRow[] | null)?.[0];
    if (row) prompts.set(localDate, row);
  }

  type Message = { to: string; title: string; body: string; data: { url: string }; priority: 'default' };
  const messages: { device: DeviceRow; message: Message }[] = [];

  for (const { device, localDate } of due) {
    const prompt = prompts.get(localDate);
    if (!prompt) {
      summary.skipped++;
      continue;
    }
    // Claim the day first: the update only succeeds if nothing was sent for
    // this local date yet, so concurrent runs cannot both send.
    const { data: claimed, error: claimError } = await admin
      .from('push_devices')
      .update({ last_daily_prompt_sent_date: localDate, updated_at: now.toISOString() })
      .eq('id', device.id)
      .eq('enabled', true)
      .is('invalid_at', null)
      .or(`last_daily_prompt_sent_date.is.null,last_daily_prompt_sent_date.lt.${localDate}`)
      .select('id');
    if (claimError || !claimed || claimed.length === 0) {
      summary.skipped++;
      continue;
    }
    messages.push({
      device,
      message: {
        to: device.expo_push_token,
        title: 'Diverge',
        body: notificationBody(prompt, device.app_language),
        data: { url: '/compose?prompt=today' },
        priority: 'default',
      },
    });
  }

  for (let i = 0; i < messages.length; i += BATCH) {
    const chunk = messages.slice(i, i + BATCH);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (expoToken) headers.Authorization = `Bearer ${expoToken}`;
    let tickets: ExpoTicket[] = [];
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(chunk.map((m) => m.message)),
      });
      const parsed = (await res.json()) as { data?: ExpoTicket[]; errors?: unknown };
      if (!res.ok || !parsed.data) {
        console.error('expo push failed', res.status, parsed.errors);
        summary.errors += chunk.length;
        continue;
      }
      tickets = parsed.data;
    } catch (e) {
      console.error('expo push request failed', e);
      summary.errors += chunk.length;
      continue;
    }

    for (const [index, ticket] of tickets.entries()) {
      const target = chunk[index];
      if (!target) continue;
      if (ticket.status === 'ok') {
        summary.sent++;
        continue;
      }
      summary.errors++;
      if (ticket.details?.error === 'DeviceNotRegistered') {
        // The token is dead (app removed, or token rotated): stop sending.
        await admin
          .from('push_devices')
          .update({ invalid_at: now.toISOString(), enabled: false, updated_at: now.toISOString() })
          .eq('id', target.device.id);
        summary.invalidated++;
      } else {
        console.error('push ticket error', target.device.id, ticket.message);
      }
    }
  }

  console.log('daily-prompt-notify', JSON.stringify(summary));
  return json({ ok: true, ...summary });
});
