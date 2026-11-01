-- A few server-side settings the app reads at launch. For now: which
-- version is on the store (so an older app can offer the update) and the
-- oldest version the server still supports (below it the app asks for the
-- update before going on). Readable by anyone; written only from the
-- dashboard.
--
-- Safe on the live database: a new table and its rows.

create table public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

create policy "App config is readable by everyone" on public.app_config
  for select to anon, authenticated using (true);

insert into public.app_config (key, value) values
  ('ios_latest_version', '1.3.0'),
  ('ios_min_version', '1.0.0'),
  ('ios_store_url', 'https://apps.apple.com/us/app/diverge-feed/id6809689660');
