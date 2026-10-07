-- Fork: a post can branch from another post ("take this thought somewhere
-- else"). The fork is an independent post that also lives in the feed; the
-- link only adds provenance. If the original is deleted the link is cleared
-- and the fork stays.
--
-- Safe on the live database: one nullable column, an index, a function, a
-- restrictive insert policy.

alter table public.posts
  add column if not exists forked_from_post_id uuid references public.posts (id) on delete set null;

create index if not exists posts_forked_from_post_id_idx
  on public.posts (forked_from_post_id)
  where forked_from_post_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'posts_no_self_fork'
  ) then
    alter table public.posts
      add constraint posts_no_self_fork check (forked_from_post_id is distinct from id);
  end if;
end $$;

-- You can only branch from a post you can see (blocks are enforced by the
-- posts SELECT policy, which this subquery goes through).
drop policy if exists "Forks come from visible posts" on public.posts;
create policy "Forks come from visible posts" on public.posts
  as restrictive for insert to authenticated
  with check (
    forked_from_post_id is null
    -- Qualified on purpose: unqualified, the name would bind to o's own column.
    or exists (select 1 from public.posts o where o.id = posts.forked_from_post_id)
  );

-- Provenance and branch counts for a set of posts, as the caller sees them:
-- an original the caller cannot see (blocked either way, or deleted) comes
-- back null, and branches by people the caller cannot see are not counted.
create or replace function public.post_fork_meta (p_ids uuid[]) returns table (
  post_id uuid,
  origin_id uuid,
  origin_user_id uuid,
  origin_username text,
  origin_display_name text,
  branch_count int
)
language sql
security invoker
stable
set search_path = public
as $$
  select
    p.id,
    o.id,
    o.user_id,
    pr.username,
    pr.display_name,
    (select count(*) from posts b where b.forked_from_post_id = p.id)::int
  from posts p
  left join posts o on o.id = p.forked_from_post_id
  left join profiles pr on pr.id = o.user_id
  where p.id = any (p_ids);
$$;

grant execute on function public.post_fork_meta (uuid[]) to authenticated;
