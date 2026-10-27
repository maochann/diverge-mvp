-- A post may be a photo with no words. "What should I write?" should never
-- be the reason not to post. A post still needs something: text or at least
-- one photo.
--
-- Safe on the live database: replaces one check constraint with a looser one.

alter table public.posts drop constraint if exists content_length;

alter table public.posts
  add constraint posts_has_something check (
    char_length(content) <= 500
    and (char_length(content) > 0 or cardinality(image_urls) > 0)
  );
