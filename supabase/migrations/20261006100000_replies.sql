-- Threaded replies (one level): a comment may answer a root comment on the
-- same post. Replies to replies are flattened by the app under the root.
--
-- Deleting a root comment that has replies leaves a tombstone so other
-- people's replies keep their place; a comment with no replies is removed
-- outright. Both go through delete_comment() so the rule lives in one place.
--
-- Safe on the live database: additive columns, a trigger, a function.

alter table public.comments
  add column if not exists parent_comment_id uuid references public.comments (id) on delete cascade;

alter table public.comments
  add column if not exists deleted_at timestamptz;

create index if not exists comments_parent_comment_id_idx
  on public.comments (parent_comment_id);

-- A reply must point at a root comment on the same post, never at itself.
-- Runs as the caller, so a comment the caller cannot see (blocked author)
-- cannot be replied to either.
create or replace function public.check_comment_parent () returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  parent_post uuid;
  parent_parent uuid;
  parent_deleted timestamptz;
begin
  if new.parent_comment_id is null then
    return new;
  end if;
  if new.parent_comment_id = new.id then
    raise exception 'a comment cannot reply to itself';
  end if;
  select post_id, parent_comment_id, deleted_at
    into parent_post, parent_parent, parent_deleted
  from comments
  where id = new.parent_comment_id;
  if not found then
    raise exception 'parent comment not found';
  end if;
  if parent_post <> new.post_id then
    raise exception 'a reply must be on the same post as its parent';
  end if;
  if parent_parent is not null then
    raise exception 'replies are one level deep';
  end if;
  if parent_deleted is not null then
    raise exception 'cannot reply to a deleted comment';
  end if;
  return new;
end;
$$;

drop trigger if exists comments_check_parent on public.comments;
create trigger comments_check_parent
before insert on public.comments
for each row
execute function public.check_comment_parent ();

-- Delete your own comment. A root comment with live replies becomes a
-- tombstone (content replaced, author kept for ownership) so the thread
-- under it survives; anything else is removed. When the last reply under a
-- tombstone goes, the tombstone goes with it.
create or replace function public.delete_comment (p_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  live_replies int;
  parent record;
begin
  if auth.uid () is null then
    raise exception 'not signed in';
  end if;
  select id, user_id, parent_comment_id into c from comments where id = p_id;
  if not found then
    return;
  end if;
  if c.user_id <> auth.uid () then
    raise exception 'not your comment';
  end if;

  select count(*) into live_replies
  from comments
  where parent_comment_id = c.id and deleted_at is null;

  if c.parent_comment_id is null and live_replies > 0 then
    update comments
    set deleted_at = now(), content = '[deleted]'
    where id = c.id;
    return;
  end if;

  delete from comments where id = c.id;

  -- Tidy a tombstone whose replies are all gone.
  if c.parent_comment_id is not null then
    select id, deleted_at into parent from comments where id = c.parent_comment_id;
    if found and parent.deleted_at is not null
       and not exists (select 1 from comments where parent_comment_id = parent.id) then
      delete from comments where id = parent.id;
    end if;
  end if;
end;
$$;

grant execute on function public.delete_comment (uuid) to authenticated;
