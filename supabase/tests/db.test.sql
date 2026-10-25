-- Database-level tests for the conversation phase (replies, fork, daily
-- prompt, push devices, block visibility). Run by run-local.sh against a
-- throwaway PostgreSQL with local-harness.sql; every block raises on failure.

create schema if not exists test;
grant usage on schema test to authenticated;
alter default privileges in schema test grant execute on functions to authenticated;

create or replace function test.as_user (u uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function test.as_admin () returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

create or replace function test.check (ok boolean, label text) returns void
language plpgsql as $$
begin
  if ok then raise notice 'ok   %', label; else raise exception 'FAIL %', label; end if;
end $$;

-- Returns the error message of a statement, or null when it succeeded.
create or replace function test.fails (stmt text) returns text
language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlerrm;
end $$;

-- Four people. Profiles are created by the sign-up trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test', '{"username":"alice","display_name":"Alice"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test', '{"username":"bob","display_name":"Bob"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test', '{"username":"cara","display_name":"Cara"}'),
  ('00000000-0000-0000-0000-00000000000d', 'd@test', '{"username":"dan","display_name":"Dan"}');

-- ---------------------------------------------------------------- replies
do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a';
  b uuid := '00000000-0000-0000-0000-00000000000b';
  c uuid := '00000000-0000-0000-0000-00000000000c';
  p1 uuid; p2 uuid; c1 uuid; r1 uuid; err text; n int;
begin
  perform test.as_user(a);
  insert into posts (user_id, content) values (a, 'post one') returning id into p1;
  insert into posts (user_id, content) values (a, 'post two') returning id into p2;

  perform test.as_user(b);
  insert into comments (post_id, user_id, content) values (p1, b, 'root') returning id into c1;

  perform test.as_user(c);
  insert into comments (post_id, user_id, content, parent_comment_id) values (p1, c, 'reply', c1) returning id into r1;
  perform test.check(r1 is not null, 'reply to a root comment is accepted');

  err := test.fails(format('insert into comments (post_id, user_id, content, parent_comment_id) values (%L, %L, %L, %L)', p1, c, 'nested', r1));
  perform test.check(err like '%one level%', 'reply to a reply is rejected: ' || coalesce(err, 'no error'));

  err := test.fails(format('insert into comments (post_id, user_id, content, parent_comment_id) values (%L, %L, %L, %L)', p2, c, 'cross', c1));
  perform test.check(err like '%same post%', 'reply on another post is rejected: ' || coalesce(err, 'no error'));

  err := test.fails(format('select public.delete_comment(%L)', c1));
  perform test.check(err like '%not your comment%', 'cannot delete someone else''s comment');

  -- Bob deletes his root while Cara's reply exists: tombstone, reply stays.
  perform test.as_user(b);
  perform public.delete_comment(c1);
  select count(*) into n from comments where id = c1 and deleted_at is not null and content = '[deleted]';
  perform test.check(n = 1, 'root with replies becomes a tombstone');
  select count(*) into n from comments where id = r1;
  perform test.check(n = 1, 'reply survives the root deletion');

  err := test.fails(format('insert into comments (post_id, user_id, content, parent_comment_id) values (%L, %L, %L, %L)', p1, b, 'late', c1));
  perform test.check(err like '%deleted%', 'cannot reply to a tombstone');

  -- Cara deletes the last reply: the tombstone goes too.
  perform test.as_user(c);
  perform public.delete_comment(r1);
  select count(*) into n from comments where id in (c1, r1);
  perform test.check(n = 0, 'deleting the last reply removes the tombstone');

  -- A comment with no replies is simply removed.
  perform test.as_user(b);
  insert into comments (post_id, user_id, content) values (p1, b, 'alone') returning id into c1;
  perform public.delete_comment(c1);
  select count(*) into n from comments where id = c1;
  perform test.check(n = 0, 'comment without replies is removed outright');
  perform test.as_admin();
end $$;

-- --------------------------------------------------- replies across a block
do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a';
  b uuid := '00000000-0000-0000-0000-00000000000b';
  c uuid := '00000000-0000-0000-0000-00000000000c';
  p uuid; cb uuid; rc uuid; n int; err text;
begin
  perform test.as_user(a);
  insert into posts (user_id, content) values (a, 'thread post') returning id into p;
  perform test.as_user(b);
  insert into comments (post_id, user_id, content) values (p, b, 'bob root') returning id into cb;
  perform test.as_user(c);
  insert into comments (post_id, user_id, content, parent_comment_id) values (p, c, 'cara reply', cb) returning id into rc;

  -- Alice blocks Bob: Bob's root is invisible to her; Cara's reply row is
  -- still readable (the app drops it because its root is hidden).
  perform test.as_user(a);
  perform public.block_user(b);
  select count(*) into n from comments where id = cb;
  perform test.check(n = 0, 'blocked person''s comment is invisible');
  select count(*) into n from comments where id = rc;
  perform test.check(n = 1, 'reply by a third person is still readable');

  -- Bob cannot reply to Alice's comment either (the parent is hidden from him).
  perform test.as_user(a);
  insert into comments (post_id, user_id, content) values (p, a, 'alice root') returning id into cb;
  perform test.as_user(b);
  err := test.fails(format('insert into comments (post_id, user_id, content, parent_comment_id) values (%L, %L, %L, %L)', p, b, 'x', cb));
  perform test.check(err is not null, 'blocked person cannot reply across the block');
  perform test.as_admin();
  delete from blocks where blocker_id = a and blocked_id = b;
end $$;

-- ------------------------------------------------------------------ fork
do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a';
  b uuid := '00000000-0000-0000-0000-00000000000b';
  c uuid := '00000000-0000-0000-0000-00000000000c';
  origin uuid; fork_b uuid; fork_c uuid; m record; err text; n int;
begin
  perform test.as_user(a);
  insert into posts (user_id, content) values (a, 'original') returning id into origin;

  perform test.as_user(b);
  insert into posts (user_id, content, forked_from_post_id) values (b, 'branch b', origin) returning id into fork_b;
  perform test.as_user(c);
  insert into posts (user_id, content, forked_from_post_id) values (c, 'branch c', origin) returning id into fork_c;

  err := test.fails(format('insert into posts (user_id, content, forked_from_post_id) values (%L, %L, %L)', c, 'ghost', gen_random_uuid()));
  perform test.check(err is not null, 'cannot fork a post that does not exist / is not visible');

  perform test.as_user(a);
  select * into m from public.post_fork_meta(array[fork_b]);
  perform test.check(m.origin_id = origin and m.origin_username = 'alice', 'fork meta names the original and its author');
  select * into m from public.post_fork_meta(array[origin]);
  perform test.check(m.branch_count = 2, 'branch count counts visible branches');

  -- Alice blocks Cara: Cara's branch no longer counts for Alice, and Cara
  -- no longer sees where her fork came from.
  perform public.block_user(c);
  select * into m from public.post_fork_meta(array[origin]);
  perform test.check(m.branch_count = 1, 'blocked person''s branch is not counted');
  perform test.as_user(c);
  select * into m from public.post_fork_meta(array[fork_c]);
  perform test.check(m.origin_id is null and m.origin_username is null, 'blocked original leaks nothing into provenance');
  perform test.check((select forked_from_post_id from posts where id = fork_c) = origin, 'the link itself is kept (only the view is hidden)');
  err := test.fails(format('insert into posts (user_id, content, forked_from_post_id) values (%L, %L, %L)', c, 'again', origin));
  perform test.check(err is not null, 'cannot fork a post hidden by a block');

  -- Original deleted: the fork stays, its link clears.
  perform test.as_user(a);
  delete from posts where id = origin;
  select count(*) into n from posts where id = fork_b;
  perform test.check(n = 1, 'fork survives deletion of the original');
  perform test.check((select forked_from_post_id from posts where id = fork_b) is null, 'fork link is cleared when the original is deleted');
  perform test.as_user(b);
  select * into m from public.post_fork_meta(array[fork_b]);
  perform test.check(m.origin_id is null and m.branch_count = 0, 'fork meta is empty after the original is gone');
  perform test.as_admin();
  delete from blocks where blocker_id = a and blocked_id = c;
end $$;

-- ---------------------------------------------------------- daily prompt
do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a';
  d1 record; d1b record; d2 record; n int; err text; p uuid;
begin
  select count(*) into n from prompt_pool;
  perform test.check(n >= 60, 'the original 60 prompts are still present: ' || n);
  perform test.check((select count(*) from prompt_pool where text_ja = '' or text_en = '') = 0, 'every prompt has both languages');

  perform test.as_user(a);
  select * into d1 from public.daily_prompt_for(current_date);
  select * into d1b from public.daily_prompt_for(current_date);
  perform test.check(d1.id = d1b.id and d1.prompt_id = d1b.prompt_id, 'same date returns the same prompt (no duplicate daily row)');
  perform test.check((select count(*) from daily_prompts where prompt_date = current_date) = 1, 'prompt_date is unique');
  select * into d2 from public.daily_prompt_for(current_date + 1);
  perform test.check(d2.prompt_id <> d1.prompt_id, 'consecutive days get different prompts');
  perform test.check(d1.text_en <> '' and d1.text_ja <> '', 'prompt text comes back in both languages');

  err := test.fails(format('select * from public.daily_prompt_for(%L)', current_date + 10));
  perform test.check(err like '%out of range%', 'far-future dates are refused');

  err := test.fails(format('insert into daily_prompts (prompt_date, prompt_id) values (%L, %L)', current_date + 30, d1.prompt_id));
  perform test.check(err is not null, 'users cannot write daily_prompts directly');

  insert into posts (user_id, content, daily_prompt_id) values (a, 'my answer', d1.id) returning id into p;
  perform test.check((select daily_prompt_id from posts where id = p) = d1.id, 'a post links to the day''s prompt');
  perform test.as_admin();
end $$;

-- ------------------------------------------------- same prompt / adjacent
do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a';
  b uuid := '00000000-0000-0000-0000-00000000000b';
  d uuid := '00000000-0000-0000-0000-00000000000d';
  dp record; pa uuid; pb uuid; pd uuid; n int;
begin
  perform test.as_user(a);
  select * into dp from public.daily_prompt_for(current_date);
  insert into posts (user_id, content, daily_prompt_id) values (a, 'alice answer', dp.id) returning id into pa;
  perform test.as_user(b);
  insert into posts (user_id, content, daily_prompt_id) values (b, 'bob answer', dp.id) returning id into pb;
  perform test.as_user(d);
  insert into posts (user_id, content, daily_prompt_id) values (d, 'dan answer', dp.id) returning id into pd;

  -- The app's candidate query: same prompt, not the subject, not its author.
  perform test.as_user(a);
  select count(*) into n from posts where daily_prompt_id = dp.id and id <> pa and user_id <> a;
  perform test.check(n = 2, 'same-prompt candidates exclude the reader''s own answers');

  perform public.block_user(d);
  select count(*) into n from posts where daily_prompt_id = dp.id and id <> pa and user_id <> a;
  perform test.check(n = 1, 'blocked person''s answer is excluded from same-prompt candidates');
  perform test.as_admin();
  delete from blocks where blocker_id = a and blocked_id = d;
end $$;

-- ---------------------------------------------------------- push devices
do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a';
  b uuid := '00000000-0000-0000-0000-00000000000b';
  tok text := 'ExponentPushToken[test-device-1]';
  row public.push_devices; err text; n int;
begin
  perform test.as_user(a);
  row := public.register_push_device(tok, 'ios', 'Asia/Tokyo', 'ja', true, '19:00');
  perform test.check(row.user_id = a and row.enabled and row.app_language = 'ja', 'device registered for the signed-in user');

  err := test.fails('select public.register_push_device(''apns:abc'', ''ios'', ''UTC'', ''en'', true, ''19:00'')');
  perform test.check(err is not null, 'malformed tokens are refused');

  -- Same phone, different account: the device moves.
  perform test.as_user(b);
  row := public.register_push_device(tok, 'ios', 'America/Vancouver', 'en', false, '07:30');
  perform test.check(row.user_id = b, 'token re-registered by another account moves to them');
  select count(*) into n from push_devices where expo_push_token = tok;
  perform test.check(n = 1, 'one row per token');

  perform test.as_user(a);
  select count(*) into n from push_devices;
  perform test.check(n = 0, 'a user cannot read another user''s device');
  update push_devices set enabled = true where expo_push_token = tok;
  select count(*) into n from push_devices where expo_push_token = tok and enabled;
  perform test.check(n = 0, 'a user cannot update another user''s device (0 rows affected)');

  -- The scheduler's claim (service role): once per local date.
  perform test.as_admin();
  update push_devices set enabled = true where expo_push_token = tok;
  update push_devices set last_daily_prompt_sent_date = '2026-10-06'
  where expo_push_token = tok and enabled and invalid_at is null
    and (last_daily_prompt_sent_date is null or last_daily_prompt_sent_date < '2026-10-06');
  get diagnostics n = row_count;
  perform test.check(n = 1, 'first claim for a local date succeeds');
  update push_devices set last_daily_prompt_sent_date = '2026-10-06'
  where expo_push_token = tok and enabled and invalid_at is null
    and (last_daily_prompt_sent_date is null or last_daily_prompt_sent_date < '2026-10-06');
  get diagnostics n = row_count;
  perform test.check(n = 0, 'second claim for the same date is a no-op (no double send)');
  update push_devices set last_daily_prompt_sent_date = '2026-10-07'
  where expo_push_token = tok and enabled and invalid_at is null
    and (last_daily_prompt_sent_date is null or last_daily_prompt_sent_date < '2026-10-07');
  get diagnostics n = row_count;
  perform test.check(n = 1, 'next local date can be claimed');

  -- Account deletion takes the device with it.
  delete from auth.users where id = b;
  select count(*) into n from push_devices where expo_push_token = tok;
  perform test.check(n = 0, 'push device is removed with the account');
end $$;

-- ------------------------------------------------------------- reactions
do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a';
  c uuid := '00000000-0000-0000-0000-00000000000c';
  d uuid := '00000000-0000-0000-0000-00000000000d';
  e uuid := '00000000-0000-0000-0000-00000000000e';
  p uuid; n int; err text;
begin
  perform test.as_admin();
  insert into auth.users (id, email, raw_user_meta_data)
  values (e, 'e@test', '{"username":"eve","display_name":"Eve"}');

  perform test.as_user(a);
  insert into posts (user_id, content) values (a, 'reacted post') returning id into p;

  perform test.as_user(c);
  insert into reactions (post_id, user_id, kind) values (p, c, 'relate');
  perform test.as_user(d);
  insert into reactions (post_id, user_id, kind) values (p, d, 'learned');
  err := test.fails(format('insert into reactions (post_id, user_id, kind) values (%L, %L, %L)', p, d, 'wow'));
  perform test.check(err is not null, 'only the three fixed words are accepted');

  -- One word per person: changing it is an update, not a second row.
  update reactions set kind = 'differs' where post_id = p and user_id = d;
  select count(*) into n from reactions where post_id = p and user_id = d;
  perform test.check(n = 1 and (select kind from reactions where post_id = p and user_id = d) = 'differs', 'a reader can change their word');

  -- Readers see only their own word.
  select count(*) into n from reactions where post_id = p;
  perform test.check(n = 1, 'a reader sees only their own reaction');
  perform test.as_user(e);
  select count(*) into n from reactions where post_id = p;
  perform test.check(n = 0, 'someone who did not react sees nothing');

  -- The author sees everyone's.
  perform test.as_user(a);
  select count(*) into n from reactions where post_id = p;
  perform test.check(n = 2, 'the author sees every reaction on their post');
  err := test.fails(format('insert into reactions (post_id, user_id, kind) values (%L, %L, %L)', p, a, 'relate'));
  perform test.check(err is not null, 'cannot react to your own post');
  err := test.fails(format('insert into reactions (post_id, user_id, kind) values (%L, %L, %L)', p, c, 'relate'));
  perform test.check(err is not null, 'cannot react as someone else');

  -- A block hides the reaction from the author.
  perform public.block_user(d);
  select count(*) into n from reactions where post_id = p;
  perform test.check(n = 1, 'a blocked reader''s word is hidden from the author');
  perform test.as_admin();
  delete from blocks where blocker_id = a and blocked_id = d;

  -- Deleting the post takes the reactions with it.
  perform test.as_user(a);
  delete from posts where id = p;
  perform test.as_admin();
  select count(*) into n from reactions where post_id = p;
  perform test.check(n = 0, 'reactions go with the post');
end $$;

-- --------------------------------------------------------- simple prompts
do $$
declare n int; dp record;
begin
  select count(*) into n from prompt_pool where active and key like 's\_%';
  perform test.check(n = 45, '45 simple prompts active: ' || n);
  select count(*) into n from prompt_pool where active and key not like 's\_%';
  perform test.check(n = 0, 'old prompts deactivated, not deleted');
  select count(*) into n from prompt_pool where not active;
  perform test.check(n = 60, 'old prompts still exist for past posts: ' || n);
  perform test.as_user('00000000-0000-0000-0000-00000000000c');
  select * into dp from public.daily_prompt_for(current_date + 2);
  perform test.check((select key from prompt_pool where id = dp.prompt_id) like 's\_%', 'new days pick only from the simple set');
  perform test.as_admin();
end $$;

-- ------------------------------------------------------- account deletion
do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a';
  c uuid := '00000000-0000-0000-0000-00000000000c';
  n int;
begin
  -- Cara's independent fork of Alice's post must outlive Alice's account.
  perform test.as_admin();
  delete from auth.users where id = a;
  select count(*) into n from posts where user_id = c;
  perform test.check(n >= 1, 'other people''s forks survive the original author''s account deletion');
  select count(*) into n from posts where user_id = a;
  perform test.check(n = 0, 'deleted account leaves no posts');
  select count(*) into n from comments where user_id = a;
  perform test.check(n = 0, 'deleted account leaves no comments or replies');
end $$;

select 'ALL DATABASE TESTS PASSED' as result;
