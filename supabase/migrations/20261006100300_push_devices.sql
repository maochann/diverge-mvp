-- Daily Prompt reminder: one push notification a day, only for people who
-- turned it on in Settings. One row per device. Nothing else is ever sent
-- through this table (no likes, replies, follows, "come back" messages).
--
-- Safe on the live database: one new table, RLS, one function.

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Expo push token: ExponentPushToken[...]. A token names a device install,
  -- so it is unique across users; logging in as someone else moves it.
  expo_push_token text not null unique,
  platform text not null,
  enabled boolean not null default false,
  -- Local wall-clock time the reminder should arrive, in the device's zone.
  preferred_time time not null default '19:00',
  timezone text not null default 'UTC',
  app_language text not null default 'en',
  last_seen_at timestamptz not null default now(),
  -- The device's local calendar date of the last reminder: at most one per day.
  last_daily_prompt_sent_date date,
  -- Set when Expo reports the token is no longer valid; never sent to again.
  invalid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_devices_platform check (platform in ('ios', 'android')),
  constraint push_devices_language check (app_language in ('en', 'ja')),
  constraint push_devices_token_format check (expo_push_token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$')
);

create index if not exists push_devices_user_id_idx on public.push_devices (user_id);

create index if not exists push_devices_enabled_idx
  on public.push_devices (enabled)
  where enabled and invalid_at is null;

alter table public.push_devices enable row level security;

drop policy if exists "Users read their own devices" on public.push_devices;
create policy "Users read their own devices" on public.push_devices
  for select to authenticated using (auth.uid () = user_id);

drop policy if exists "Users update their own devices" on public.push_devices;
create policy "Users update their own devices" on public.push_devices
  for update to authenticated using (auth.uid () = user_id)
  with check (auth.uid () = user_id);

drop policy if exists "Users remove their own devices" on public.push_devices;
create policy "Users remove their own devices" on public.push_devices
  for delete to authenticated using (auth.uid () = user_id);

-- Inserts go through register_push_device() so a token that moved to another
-- account on the same phone is reassigned instead of colliding.

create or replace function public.register_push_device (
  p_token text,
  p_platform text,
  p_timezone text,
  p_language text,
  p_enabled boolean,
  p_preferred_time time
) returns public.push_devices
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.push_devices;
begin
  if auth.uid () is null then
    raise exception 'not signed in';
  end if;
  -- The device now belongs to whoever is signed in on it.
  delete from push_devices where expo_push_token = p_token and user_id <> auth.uid ();

  insert into push_devices (
    user_id, expo_push_token, platform, timezone, app_language, enabled, preferred_time
  )
  values (auth.uid (), p_token, p_platform, p_timezone, p_language, p_enabled, p_preferred_time)
  on conflict (expo_push_token) do update set
    platform = excluded.platform,
    timezone = excluded.timezone,
    app_language = excluded.app_language,
    enabled = excluded.enabled,
    preferred_time = excluded.preferred_time,
    last_seen_at = now(),
    invalid_at = null,
    updated_at = now()
  returning * into row;
  return row;
end;
$$;

grant execute on function public.register_push_device (text, text, text, text, boolean, time) to authenticated;
