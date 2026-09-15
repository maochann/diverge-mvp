-- Diverge MVP schema
-- Apply once in the Supabase SQL editor (or via `supabase db push`).
-- Everything is idempotent-ish for a fresh project; re-running on an existing
-- database may error on existing objects.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint display_name_length check (char_length(display_name) between 1 and 50),
  constraint bio_length check (bio is null or char_length(bio) <= 160)
);

-- Case-insensitive uniqueness for usernames.
create unique index profiles_username_unique on public.profiles (lower(username));

create table public.posts (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  image_url text,
  created_at timestamptz not null default now(),
  constraint content_length check (char_length(content) between 1 and 500)
);

create index posts_created_at_idx on public.posts (created_at desc);

create index posts_user_id_idx on public.posts (user_id);

create table public.likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- One like per user per post.
  primary key (post_id, user_id)
);

create index likes_user_id_idx on public.likes (user_id);

create table public.comments (
  id uuid primary key default gen_random_uuid (),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  constraint comment_length check (char_length(content) between 1 and 300)
);

create index comments_post_id_created_at_idx on public.comments (post_id, created_at);

-- ---------------------------------------------------------------------------
-- Automatic profile creation on sign-up
-- The app passes username/display_name in auth metadata; this trigger turns
-- them into a profile row. Runs as definer so it bypasses RLS.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user () returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', 'user_' || left(new.id::text, 8)),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'New user')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user ();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Reads are open to any signed-in user (this is a shared feed for a private
-- test group). Writes are restricted to the content owner.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

alter table public.posts enable row level security;

alter table public.likes enable row level security;

alter table public.comments enable row level security;

-- profiles
create policy "Profiles are readable by signed-in users" on public.profiles
  for select to authenticated using (true);

create policy "Users can update their own profile" on public.profiles
  for update to authenticated using (auth.uid () = id)
  with check (auth.uid () = id);

-- posts (no update policy on purpose: posts cannot be edited, only deleted)
create policy "Posts are readable by signed-in users" on public.posts
  for select to authenticated using (true);

create policy "Users can create their own posts" on public.posts
  for insert to authenticated with check (auth.uid () = user_id);

create policy "Users can delete their own posts" on public.posts
  for delete to authenticated using (auth.uid () = user_id);

-- likes
create policy "Likes are readable by signed-in users" on public.likes
  for select to authenticated using (true);

create policy "Users can like as themselves" on public.likes
  for insert to authenticated with check (auth.uid () = user_id);

create policy "Users can remove their own likes" on public.likes
  for delete to authenticated using (auth.uid () = user_id);

-- comments (no update policy: comments can only be added or deleted)
create policy "Comments are readable by signed-in users" on public.comments
  for select to authenticated using (true);

create policy "Users can comment as themselves" on public.comments
  for insert to authenticated with check (auth.uid () = user_id);

create policy "Users can delete their own comments" on public.comments
  for delete to authenticated using (auth.uid () = user_id);

-- ---------------------------------------------------------------------------
-- Storage: public-read buckets for avatars and post images.
-- Uploads must go into a folder named after the uploader's user id
-- (the app does this), which is what the policies below enforce.
-- ---------------------------------------------------------------------------

-- 5 MB max per file; images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('post-images', 'post-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Users upload images to their own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('avatars', 'post-images')
    and (storage.foldername (name))[1] = auth.uid ()::text
  );

create policy "Users can delete their own images" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('avatars', 'post-images')
    and (storage.foldername (name))[1] = auth.uid ()::text
  );

-- ---------------------------------------------------------------------------
-- Follow System (added 2026-09-15)
-- One row per (follower, followed). All accounts are public; following is an
-- explicit choice, so nothing here is derived from behaviour. Applied on an
-- existing database by running just this section in the SQL editor.
-- ---------------------------------------------------------------------------

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_not_self check (follower_id <> following_id)
);

-- Cascade deletes and any future "followers of X" lookups.
create index follows_following_id_idx on public.follows (following_id);

alter table public.follows enable row level security;

-- Only your own outgoing follows are visible: nobody can read anyone else's
-- follow graph (no follower counts or lists anywhere in V1).
create policy "Users read their own follows" on public.follows
  for select to authenticated using (auth.uid () = follower_id);

create policy "Users follow as themselves" on public.follows
  for insert to authenticated with check (auth.uid () = follower_id);

create policy "Users unfollow as themselves" on public.follows
  for delete to authenticated using (auth.uid () = follower_id);

-- Explore ordering: people-balanced, not popularity-based.
-- Eligible posts are those by people the caller does not follow (and not the
-- caller's own). Each person's posts are ranked newest-first; the feed is
-- ordered by rank, then recency, so every eligible person appears once before
-- anyone appears a second time. Likes, follower counts and viewing history
-- are deliberately not inputs.
--
-- p_cutoff freezes the session: posts created after it never enter, so ranks
-- and cursors stay stable while the reader is on a chapter. The effective
-- cutoff (clamped to now()) is returned so the client can reuse it.
-- Runs as the caller, so posts/follows RLS applies.
create or replace function public.explore_chapter (
  p_cutoff timestamptz,
  p_limit int,
  p_after_rank int default null,
  p_after_created_at timestamptz default null,
  p_after_id uuid default null
) returns table (
  post_id uuid,
  rank int,
  created_at timestamptz,
  cutoff timestamptz
)
language sql
security invoker
stable
set search_path = public
as $$
  with c as (
    select least(p_cutoff, now()) as t
  ),
  eligible as (
    select p.id, p.user_id, p.created_at
    from posts p, c
    where p.created_at <= c.t
      and p.user_id <> auth.uid ()
      and p.user_id not in (
        select following_id from follows where follower_id = auth.uid ()
      )
  ),
  ranked as (
    select id, created_at,
      (row_number() over (partition by user_id order by created_at desc, id desc))::int as rank
    from eligible
  )
  select r.id, r.rank, r.created_at, c.t
  from ranked r, c
  where p_after_rank is null
    or r.rank > p_after_rank
    or (r.rank = p_after_rank
        and (r.created_at < p_after_created_at
             or (r.created_at = p_after_created_at and r.id < p_after_id)))
  order by r.rank, r.created_at desc, r.id desc
  limit p_limit;
$$;

grant execute on function public.explore_chapter (timestamptz, int, int, timestamptz, uuid) to authenticated;
