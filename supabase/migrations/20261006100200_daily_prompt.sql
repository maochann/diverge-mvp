-- Daily Prompt ("今日のきっかけ"): one quiet question a day, the same for
-- everyone on the same calendar day, as a small reason to contribute.
--
-- prompt_pool holds the questions (bilingual; more can be added later).
-- daily_prompts records which question a date got; a post may point at the
-- day's prompt it answered. Nothing here tracks streaks or completion.
--
-- Safe on the live database: two new tables, one nullable column, a function.

create table if not exists public.prompt_pool (
  id uuid primary key default gen_random_uuid (),
  -- Stable handle so the seed can be re-run without duplicates.
  key text not null unique,
  text_en text not null,
  text_ja text not null,
  category text not null default 'noticing',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint prompt_pool_text_en_length check (char_length(text_en) between 1 and 140),
  constraint prompt_pool_text_ja_length check (char_length(text_ja) between 1 and 140)
);

create table if not exists public.daily_prompts (
  id uuid primary key default gen_random_uuid (),
  prompt_date date not null unique,
  prompt_id uuid not null references public.prompt_pool (id),
  created_at timestamptz not null default now()
);

alter table public.posts
  add column if not exists daily_prompt_id uuid references public.daily_prompts (id) on delete set null;

create index if not exists posts_daily_prompt_id_idx
  on public.posts (daily_prompt_id)
  where daily_prompt_id is not null;

alter table public.prompt_pool enable row level security;
alter table public.daily_prompts enable row level security;

drop policy if exists "Active prompts are readable" on public.prompt_pool;
create policy "Active prompts are readable" on public.prompt_pool
  for select to authenticated using (active);

drop policy if exists "Daily prompts are readable" on public.daily_prompts;
create policy "Daily prompts are readable" on public.daily_prompts
  for select to authenticated using (true);

-- No insert/update/delete policies: rows are written only by the function
-- below (definer) and by the developer in the dashboard.

-- The prompt for a calendar date, created on first request. The choice is a
-- deterministic hash of the date over the prompts not used recently, so two
-- people asking at the same moment agree without a race, and the same
-- question does not come back for weeks. Dates are the caller's local day,
-- so only a small window around today is accepted.
create or replace function public.daily_prompt_for (p_date date) returns table (
  id uuid,
  prompt_date date,
  prompt_id uuid,
  text_en text,
  text_ja text
)
language plpgsql
security definer
set search_path = public
as $$
-- The OUT columns share names with daily_prompts columns; inside SQL here,
-- a bare name always means the table column.
#variable_conflict use_column
declare
  chosen uuid;
begin
  if p_date < current_date - 2 or p_date > current_date + 2 then
    raise exception 'date out of range';
  end if;

  if not exists (select 1 from daily_prompts d where d.prompt_date = p_date) then
    -- Prefer prompts unused in the last 45 days, then 7, then anything active.
    select pp.id into chosen
    from prompt_pool pp
    where pp.active
      and pp.id not in (
        select d.prompt_id from daily_prompts d where d.prompt_date > p_date - 45
      )
    order by md5(p_date::text || pp.key)
    limit 1;

    if chosen is null then
      select pp.id into chosen
      from prompt_pool pp
      where pp.active
        and pp.id not in (
          select d.prompt_id from daily_prompts d where d.prompt_date > p_date - 7
        )
      order by md5(p_date::text || pp.key)
      limit 1;
    end if;

    if chosen is null then
      select pp.id into chosen
      from prompt_pool pp
      where pp.active
      order by md5(p_date::text || pp.key)
      limit 1;
    end if;

    if chosen is null then
      return;
    end if;

    insert into daily_prompts (prompt_date, prompt_id)
    values (p_date, chosen)
    on conflict (prompt_date) do nothing;
  end if;

  return query
    select d.id, d.prompt_date, d.prompt_id, pp.text_en, pp.text_ja
    from daily_prompts d
    join prompt_pool pp on pp.id = d.prompt_id
    where d.prompt_date = p_date;
end;
$$;

grant execute on function public.daily_prompt_for (date) to authenticated, service_role;

-- Seed: 60 prompts. None asks for anything private or painful.
insert into public.prompt_pool (key, text_en, text_ja, category) values
  ('caught_eye', 'What caught your eye today?', '今日、目に留まったものは？', 'noticing'),
  ('sky', 'What did the sky look like today?', '今日の空はどんな感じだった？', 'noticing'),
  ('small_noticed', 'Something small you noticed.', '今日気づいた小さなこと。', 'noticing'),
  ('sound', 'A sound you heard today.', '今日聞こえた音は？', 'senses'),
  ('ordinary_keep', 'Something ordinary worth keeping.', '残しておきたい、何でもない瞬間は？', 'noticing'),
  ('laugh', 'What made you laugh today?', '今日ちょっと笑ったこと。', 'noticing'),
  ('learned', 'Something you learned today.', '今日知った小さなこと。', 'learning'),
  ('question_mind', 'A question that''s been on your mind.', '最近頭にある問いは？', 'question'),
  ('felt_different', 'Something that felt different today.', '今日、少し違って見えたもの。', 'perspective'),
  ('changed_mind', 'What''s one thing you changed your mind about recently?', '最近、考えが変わったことは？', 'perspective'),
  ('on_the_way', 'Something you saw on your way somewhere.', '移動中に見つけたものは？', 'place'),
  ('show_newcomer', 'What would you show someone who had never been here?', 'ここを知らない人に一つ見せるなら？', 'place'),
  ('seen_differently', 'What''s something people around you might see differently?', '周りの人とは少し違って見えていることは？', 'perspective'),
  ('surprised', 'One small thing that surprised you.', '今日ちょっと驚いたこと。', 'noticing'),
  ('almost_missed', 'Something you almost didn''t notice.', '見落としかけたものは？', 'noticing'),
  ('color', 'A colour that stood out today.', '今日いちばん印象に残った色は？', 'senses'),
  ('smell', 'A smell that took you somewhere.', 'ふと記憶を呼び起こした匂いは？', 'senses'),
  ('texture', 'Something you touched and remembered touching.', '今日触れて、感触が残っているものは？', 'senses'),
  ('ate', 'Something you ate slowly today.', '今日ゆっくり味わったものは？', 'senses'),
  ('light', 'Where did the light fall nicely today?', '今日、光がきれいだった場所は？', 'noticing'),
  ('window', 'What''s outside your window right now?', '今、窓の外には何が見える？', 'place'),
  ('corner', 'A corner of your day nobody else saw.', '今日、あなただけが見た一角は？', 'noticing'),
  ('walk', 'Something from a walk, short or long.', '散歩の途中で見つけたものは？', 'place'),
  ('weather_feel', 'How did the weather feel on your skin today?', '今日の天気は肌にどう感じた？', 'senses'),
  ('waiting', 'What did you notice while waiting for something?', '何かを待っている間に気づいたことは？', 'noticing'),
  ('reread', 'A line you read twice.', '二度読み返した一文は？', 'learning'),
  ('word', 'A word you liked today.', '今日気に入った言葉は？', 'learning'),
  ('song_stuck', 'A song that stayed with you today.', '今日ずっと頭に残っていた曲は？', 'senses'),
  ('made', 'Something you made with your hands.', '今日、手で作ったものは？', 'learning'),
  ('fixed', 'Something you fixed, or tried to.', '直したもの、直そうとしたものは？', 'learning'),
  ('habit', 'A small habit you''re noticing in yourself.', '最近、自分の中で気づいた小さな癖は？', 'perspective'),
  ('rule', 'An unwritten rule you noticed today.', '今日気づいた暗黙のルールは？', 'perspective'),
  ('assumption', 'An assumption you caught yourself making.', '自分が決めつけていたことに気づいた瞬間は？', 'perspective'),
  ('two_ways', 'Something that could be read two ways.', 'ふた通りに読めるものに出会った？', 'perspective'),
  ('other_side', 'What might this look like from the other side of the street?', '通りの向こう側からは、どう見えているだろう？', 'perspective'),
  ('older', 'How would you have seen today a few years ago?', '数年前の自分なら、今日をどう見ただろう？', 'perspective'),
  ('kid', 'Something a child would find interesting here.', '子どもなら面白がりそうなものは？', 'perspective'),
  ('useful', 'A tool or object that quietly did its job today.', '今日、黙々と役目を果たしていた道具は？', 'noticing'),
  ('repair', 'Something that''s wearing out gracefully.', 'いい感じに使い込まれているものは？', 'noticing'),
  ('new_here', 'Something new in a place you know well.', 'よく知っている場所の、新しい変化は？', 'change'),
  ('gone', 'Something that''s gone from a place you know.', 'よく知っている場所から、なくなったものは？', 'change'),
  ('season', 'A sign the season is turning.', '季節が動いているしるしは？', 'change'),
  ('morning', 'The first thing you noticed this morning.', '今朝、最初に気づいたことは？', 'noticing'),
  ('evening', 'How does the day look from here, at the end of it?', '一日の終わりから見ると、今日はどんな日？', 'perspective'),
  ('kindness', 'A small kindness you saw happen.', '今日見かけた、ささやかな親切は？', 'noticing'),
  ('stranger', 'Something about a stranger you''ll remember.', '通りすがりの人で、記憶に残ったことは？', 'noticing'),
  ('conversation', 'A line from a conversation that stayed with you.', '今日の会話で残っている一言は？', 'learning'),
  ('overheard', 'Something you overheard today.', '今日、小耳にはさんだ言葉は？', 'senses'),
  ('quiet', 'Where was it quiet today?', '今日、静かだった場所は？', 'place'),
  ('crowd', 'What did a crowd look like from where you stood?', 'あなたのいた場所から、人の集まりはどう見えた？', 'perspective'),
  ('map', 'A place you''d mark on a map of today.', '今日の地図に印をつけるなら、どこ？', 'place'),
  ('photo_not_taken', 'A photo you didn''t take.', '撮らなかった写真について。', 'noticing'),
  ('shadow', 'A shadow or reflection you noticed.', '今日気づいた影や反射は？', 'noticing'),
  ('pattern', 'A pattern you spotted.', '今日見つけた模様や規則性は？', 'noticing'),
  ('number', 'A number that meant something today.', '今日、意味を持った数字は？', 'learning'),
  ('wrong', 'Something you got wrong and found interesting.', '間違えて、かえって面白かったことは？', 'learning'),
  ('slow', 'Something that happened slower than you expected.', '思ったよりゆっくり進んだことは？', 'change'),
  ('fast', 'Something that went faster than you expected.', '思ったより早く終わったことは？', 'change'),
  ('tomorrow', 'One thing you''d like to look at more closely tomorrow.', '明日もう少しよく見てみたいものは？', 'question'),
  ('ask', 'A question you''d like to ask someone here.', 'ここにいる誰かに聞いてみたい質問は？', 'question')
on conflict (key) do nothing;
