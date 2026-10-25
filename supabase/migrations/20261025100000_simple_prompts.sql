-- Simpler prompts. The first set read like interview questions; these are
-- plain nouns and short phrases, the kind of thing you'd answer with one
-- photo or one line. Old prompts are deactivated, not deleted: posts that
-- answered them keep their link.

update public.prompt_pool set active = false where key not like 's\_%';

insert into public.prompt_pool (key, text_en, text_ja, category) values
  ('s_sky', 'Today''s sky', '今日の空', 'today'),
  ('s_meal', 'Today''s meal', '今日のごはん', 'today'),
  ('s_here', 'Where you are right now', 'いまいる場所', 'now'),
  ('s_desk', 'Your desk', '机の上', 'place'),
  ('s_window', 'Outside the window', '窓の外', 'place'),
  ('s_shoes', 'Today''s shoes', '今日の靴', 'today'),
  ('s_drink', 'Something you drank today', '今日飲んだもの', 'today'),
  ('s_snack', 'Today''s snack', '今日のおやつ', 'today'),
  ('s_song', 'A song from today', '今日聴いた曲', 'today'),
  ('s_color', 'A colour from today', '今日見た色', 'today'),
  ('s_wayhome', 'The way home', '帰り道', 'place'),
  ('s_bag', 'What''s in your bag', 'かばんの中身', 'things'),
  ('s_hand', 'What''s in your hand', 'いま手に持っているもの', 'now'),
  ('s_pocket', 'What''s in your pocket', 'ポケットの中', 'things'),
  ('s_bought', 'Something you bought recently', '最近買ったもの', 'things'),
  ('s_into', 'Something you''re into lately', '最近ハマっているもの', 'things'),
  ('s_laugh', 'Something that made you laugh today', '今日笑ったこと', 'today'),
  ('s_sound', 'A sound right now', 'いま聞こえる音', 'now'),
  ('s_weather', 'Today''s weather', '今日の天気', 'today'),
  ('s_street', 'A street you walked today', '今日歩いた道', 'place'),
  ('s_fridge', 'Inside the fridge', '冷蔵庫の中', 'things'),
  ('s_plant', 'A plant nearby', '近くの植物', 'place'),
  ('s_light', 'Today''s light', '今日の光', 'today'),
  ('s_breakfast', 'Breakfast today', '今日の朝ごはん', 'today'),
  ('s_dinner', 'Dinner today', '今日の晩ごはん', 'today'),
  ('s_tired', 'How tired you are', '今日の疲れ度', 'today'),
  ('s_word', 'One word for today', '今日のひとこと', 'today'),
  ('s_crave', 'What you want to eat', 'いま食べたいもの', 'now'),
  ('s_wearing', 'What you''re wearing', '今日の服', 'today'),
  ('s_evening', 'This evening', '今日の夕方', 'today'),
  ('s_morning', 'This morning', '今日の朝', 'today'),
  ('s_corner', 'A corner of your room', '部屋の一角', 'place'),
  ('s_cup', 'Your usual cup', 'いつものコップ', 'things'),
  ('s_neighbourhood', 'A photo from your neighbourhood', '近所の一枚', 'place'),
  ('s_lastphoto', 'The last photo on your phone', 'カメラロールの最後の一枚', 'things'),
  ('s_read', 'Something you read recently', '最近読んだもの', 'things'),
  ('s_smell', 'A smell from today', '今日のにおい', 'today'),
  ('s_find', 'A small find today', '今日の小さい発見', 'today'),
  ('s_bed', 'Before bed tonight', '今日の寝る前', 'today'),
  ('s_road', 'A photo from the road', '移動中の一枚', 'place'),
  ('s_sunset', 'Today''s sunset', '今日の夕焼け', 'today'),
  ('s_cafe', 'Today''s cup', '今日の一杯', 'today'),
  ('s_animal', 'An animal nearby', '近くの動物', 'place'),
  ('s_shadow', 'A shadow from today', '今日の影', 'today'),
  ('s_tomorrow', 'Something for tomorrow', '明日やりたいこと', 'tomorrow')
on conflict (key) do update
  set text_en = excluded.text_en, text_ja = excluded.text_ja, category = excluded.category, active = true;
