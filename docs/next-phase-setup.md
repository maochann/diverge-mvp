# Conversation phase: what to set up by hand

Everything in code is done. These are the steps that need credentials or
dashboard access only the account owner has. Do them in order; each one
is independent of the app build.

## 1. Database migrations (required before shipping this build)

**Done 2026-10-08** via the SQL editor; verified: 60 prompts, 5 functions, new columns and tables present, `daily_prompt_for(current_date)` returns a row.

The app now expects the objects created by the four files in
`supabase/migrations/`. Until they are applied, every post query in the new
build fails (it calls `post_fork_meta` and embeds `daily_prompts`), so apply
them before installing the new build on any device.

They are additive only: no table is dropped, no column removed, no existing
data changed. All four were applied to a clean PostgreSQL copy of the schema
and exercised by `supabase/tests/db.test.sql` (42 checks) before being
committed.

**Option A, Supabase CLI** (needs a login in that terminal):

```bash
cd ~/Projects/diverge-mvp
npx supabase login
npx supabase db push --linked --include-all
```

If `db push` complains that the remote has no migration history, that is
expected (the original schema was applied by hand). Run the four files in
order with Option B instead.

**Option B, SQL editor** (Dashboard → SQL Editor → New query). Paste and run
each file, in this order, one at a time:

1. `supabase/migrations/20261006100000_replies.sql`
2. `supabase/migrations/20261006100100_fork.sql`
3. `supabase/migrations/20261006100200_daily_prompt.sql`
4. `supabase/migrations/20261006100300_push_devices.sql`

The editor asks for confirmation on `drop policy if exists` statements;
answer Run. "policy … does not exist, skipping" notices are normal on the
first run.

Quick check afterwards (SQL editor):

```sql
select count(*) as prompts from prompt_pool;              -- 60
select * from daily_prompt_for(current_date);              -- one row
select proname from pg_proc where proname in ('delete_comment','post_fork_meta','register_push_device');
```

## 2. Edge Function for the Daily Prompt reminder

**Secret set 2026-10-08** (`DAILY_PROMPT_CRON_SECRET`, copy kept in `~/Documents/diverge-secrets.txt`, mode 600, not in git). **Deployed 2026-10-08** (v1, verify_jwt off). Checked: no secret → 403 `forbidden`; with secret → `{ok:true, checked:0, …}`. Note: the CLI reads its login from the macOS keychain, so the first deploy asks for the Mac login password ("Always Allow").

```bash
cd ~/Projects/diverge-mvp
npx supabase functions deploy daily-prompt-notify --project-ref mvpjyfigicxviowffhvj --no-verify-jwt
npx supabase secrets set DAILY_PROMPT_CRON_SECRET="$(openssl rand -hex 32)" --project-ref mvpjyfigicxviowffhvj
```

Keep the generated secret: the scheduler below sends it as a header. The
function refuses any request without it. (`--no-verify-jwt` because the
caller is the scheduler, not a signed-in user; the secret is the guard.)

Optional, recommended: an Expo access token so Expo's push security can be
turned on later.

```bash
npx supabase secrets set EXPO_ACCESS_TOKEN="<token from expo.dev → Account → Access tokens>" --project-ref mvpjyfigicxviowffhvj
```

## 3. Scheduler (pg_cron + pg_net)

**Done 2026-10-08**: extensions enabled, job `daily-prompt-notify` (jobid 1) runs `*/10 * * * *`. Until the function is deployed each tick gets a 404, which is harmless.

Dashboard → Database → Extensions: enable `pg_cron` and `pg_net`. Then in
the SQL editor (replace the two placeholders):

```sql
select cron.schedule(
  'daily-prompt-notify',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://mvpjyfigicxviowffhvj.supabase.co/functions/v1/daily-prompt-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<DAILY_PROMPT_CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Every 10 minutes the function looks at enabled devices, works out each
one's local time, and sends to those whose preferred time was reached in
the last 90 minutes and who have not had today's reminder. Nothing is sent
outside that window; a missed day is simply missed.

To pause it: `select cron.unschedule('daily-prompt-notify');`

## 4. Apple push credentials (once)

Expo push needs an APNs key on the EAS project:

```bash
cd ~/Projects/diverge-mvp
npx --yes eas-cli@latest credentials --platform ios
```

Choose the production profile → Push Notifications → set up a new key (EAS
creates it in the Apple Developer account; needs your Apple login). The
next `eas build` picks it up automatically; the `aps-environment`
entitlement is added by the `expo-notifications` plugin.

## 5. Build

New native modules (expo-localization, expo-notifications, expo-device,
datetimepicker) mean a new binary; the old TestFlight build cannot run this
code.

```bash
npx --yes eas-cli@latest build --platform ios --profile production --auto-submit
```

## 6. Privacy policy (recommended, not blocking)

**Done 2026-10-08**: `privacy.html` in Kyle1-2-3/diverge-legal updated (reminder data, replies, fork provenance, DeepL and Expo as processors, Settings paths; last-updated date bumped). App Store Connect → App Privacy still needs "Device ID" added (App Functionality, not linked, not tracking) before the next submission.

The reminder stores an Expo push token, platform, time zone, app language
and the preferred time per device, only when the person turns the reminder
on. The current policy at https://kyle1-2-3.github.io/diverge-legal/privacy.html
lists account data, content, choices, reports and logs, and says the app
collects no device identifiers. A push token is close to a device
identifier, so add a short paragraph such as:

> **Daily prompt reminder (optional).** If you turn the reminder on in
> Settings, we store a push notification token for your device, your
> device's time zone, your app language and the time you chose, so that we
> can send one notification a day with the day's prompt. Turning the
> reminder off, or deleting your account, removes this.

The policy is in the public repo `Kyle1-2-3/diverge-legal`; edit
`privacy.html` and push. App Store Connect's App Privacy answers should
then also include "Device ID" under "App Functionality" (not linked to
identity, not used for tracking).

## 7. Supabase translate function

Unchanged and still deployed. The cache key stays (post, target language);
the app now asks for the app language rather than the device language.

## 8. 2026-10-25 migrations (prompt room + reactions)

**Applied 2026-10-25** via the SQL editor: `20261025100000_simple_prompts.sql` (45 active, 60 retired) and `20261025100100_reactions.sql` (table + 5 policies). Tomorrow's prompt verified as one of the new set. Needs a new build (1.2) to reach users; the 1.1 build keeps working (it never reads `reactions`).
