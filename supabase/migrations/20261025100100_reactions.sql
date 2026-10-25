-- Reactions: three fixed words a reader can leave on a post. No counts
-- anywhere. The reader sees only their own word; the post's author sees who
-- left which word. Nobody is notified. This is "your writing reached
-- someone", not a score.
--
-- Safe on the live database: one new table with RLS. Likes are untouched
-- (the app simply stops showing them).

create table if not exists public.reactions (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id),
  constraint reactions_kind check (kind in ('relate', 'learned', 'differs'))
);

create index if not exists reactions_user_id_idx on public.reactions (user_id);

alter table public.reactions enable row level security;

-- Your own reactions, plus every reaction on your own posts.
drop policy if exists "Own reactions and reactions on own posts" on public.reactions;
create policy "Own reactions and reactions on own posts" on public.reactions
  for select to authenticated
  using (
    user_id = auth.uid ()
    or exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid ())
  );

drop policy if exists "Reactions are hidden across a block" on public.reactions;
create policy "Reactions are hidden across a block" on public.reactions
  as restrictive for select to authenticated
  using (not public.blocked_either_way (auth.uid (), user_id));

-- React as yourself, only to a post you can see, never to your own.
drop policy if exists "React as yourself" on public.reactions;
create policy "React as yourself" on public.reactions
  for insert to authenticated
  with check (
    user_id = auth.uid ()
    and exists (select 1 from public.posts p where p.id = post_id and p.user_id <> auth.uid ())
  );

drop policy if exists "Change your own reaction" on public.reactions;
create policy "Change your own reaction" on public.reactions
  for update to authenticated using (user_id = auth.uid ()) with check (user_id = auth.uid ());

drop policy if exists "Remove your own reaction" on public.reactions;
create policy "Remove your own reaction" on public.reactions
  for delete to authenticated using (user_id = auth.uid ());
