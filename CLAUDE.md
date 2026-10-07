# Diverge MVP — project rules for Claude Code

## Scope rules (standing — do not override without an explicit new user instruction)

This project is a **clean, generic social-network MVP foundation**. It is
completely separate from every previous Diverge prototype, mockup, website, or
repository.

- Do NOT inspect, reference, import, or copy anything from outside this
  directory — in particular any previous Diverge mockup or prototype.
- Do NOT introduce Diverge-specific product concepts (including but not limited
  to: Intentional Mode, Bubble Map, Perspective Flip, AI Reflection, "Why am I
  seeing this?", diversity scores, algorithm selection, business-model
  switching) unless the user explicitly asks for them in a new instruction.
- Do NOT add: recommendation/personalized feeds, ads, subscriptions, AI
  features, DMs, group chats, stories, notifications, follow/friend systems,
  search/discovery, trending, infinite-scroll engagement mechanics, analytics
  or admin dashboards, gamification — or equivalents under different names.
- The feed is strictly reverse-chronological for all users. Keep it that way.
- When a product decision is unspecified, choose the simplest neutral option.
- "Diverge" is only a temporary app name; keep branding neutral and minimal.

## Diverge features explicitly authorized by the user

Only these three may exist; everything else in the scope list above still
requires a new explicit instruction.

- **Finite Feed** (2026-09-07) — the feed is read in chapters of
  `CHAPTER_SIZE` posts with an explicit end card; no auto-load, no timers, no
  badges. Chapter numbers stay low-key. "End of chapter" (more exists) and
  "You're caught up" (nothing older) are distinct states. Every session is a
  snapshot (`cutoff` = when it began): posts created later wait for the next
  session, and follow changes never rewrite chapters already on screen.
- **Feed Intent** (2026-09-07, given meaning 2026-09-15) — Catch up / Mix it
  up / Explore at the top of the feed. The only inputs to what is shown are
  this choice and who the reader follows.
  - Catch up = posts by people the reader follows, newest first. **Own posts
    are excluded** (they live on the Profile tab). Never backfilled with
    non-followed people: an empty Catch up is a true statement.
  - Explore = posts by people the reader does not follow (own excluded),
    people-balanced: one post from every eligible person before anyone's
    second (`explore_chapter` SQL function, ordered by rank, then recency).
  - Mix it up = `MIX_FOLLOWED_COUNT` followed + `MIX_OUTSIDE_COUNT` outside per
    chapter in a fixed F F O pattern; either side fills in for the other. When
    one side is empty, a one-line `ChapterNote` says so.
  - Ranking signals that must NOT be used, ever: likes, comment counts,
    follower counts, viewing time, profile opens, mutual follows, posting
    frequency.
- **Follow System** (2026-09-15) — `follows(follower_id, following_id)`.
  Following is an explicit choice, not a popularity signal:
  - Follow / Following button only on another person's profile
    (`user/[id]`), never on a post. Post and comment authors open the profile.
  - No follower counts or lists anywhere. The reader's own Following list
    (`following`) exists to review and undo choices; the count on the Profile
    tab is a caption, not a stat.
  - No follow notifications, no "follows you" badge, no private accounts or
    follow requests.
  - RLS: users can only read their own outgoing follows. Do not widen this
    without a new instruction.
  - Relation state (follow / mute / block sets) lives in `RelationsProvider`
    (server is the source of truth; nothing persisted on device). Never fall
    back to "everyone" when the sets fail to load.
- **Safety: Mute / Block / Report** (2026-09-15) — required for App Store
  review of user-generated content, so these are not optional.
  - Mute is one-directional and private: the muted person's posts leave the
    reader's Catch up / Mix / Explore. Nothing else changes; they are not told.
  - Block is two-directional and enforced in the database: `blocked_either_way()`
    is consulted by the SELECT policies on profiles, posts, comments and likes,
    so no screen can leak content across a block. `block_user()` records the
    block and removes follows and mutes both ways in one transaction. Blocks
    are not optimistic on the client.
  - Report (`reports` table) is insert-only for users and reviewed in the
    Supabase dashboard. Post and profile "…" menus carry Report and Block.
  - No counts, notifications or badges for any of these. Own lists only
    (`people/[list]`).
- **App Store prerequisites** (2026-09-15): terms acceptance at sign-up
  (`profiles.terms_accepted_at`), in-app account deletion
  (`delete-account` Edge Function, from Edit profile), public Terms / Privacy pages
  (`src/constants/legal.ts`).
- **Conversation phase** (authorized 2026-10-06, all shipped together):
  - **Localization** — EN / JA app text through `src/i18n` (typed
    dictionary, `useI18n()` / `useT()` in components, `tStatic` outside
    React). Settings → Language: System / English / 日本語, persisted on the
    device. User content is never translated by the app language; "See
    translation" targets the app language. Intent names stay in English.
  - **Replies** — one level: `comments.parent_comment_id` points only at a
    root comment on the same post (trigger-enforced). Replying to a reply
    flattens under the root and addresses the person. Deleting a root with
    replies leaves a tombstone (`deleted_at`) via `delete_comment()`; the
    tombstone goes when its last reply goes. No reply notifications.
  - **Fork** — `posts.forked_from_post_id`, set null when the original is
    deleted; the fork is an ordinary post that also lives in the feed.
    Provenance ("Branched from @name") shows only while the original is
    visible to the reader; `post_fork_meta()` runs as the reader. Fork is
    not a repost, quote or disagreement button; no stance is recorded.
  - **Daily Prompt** — `prompt_pool` (bilingual) + `daily_prompts` (one per
    calendar date, deterministic choice via `daily_prompt_for()`), posts
    may carry `daily_prompt_id`. A quiet offer in the composer; never
    required, no streaks, no completion state.
  - **Daily Prompt reminder** — the only notification. Default off; turned
    on in Settings (permission asked only there); one push per device per
    local day, body = the prompt in the app language, no badge, no sound,
    no second reminder, nothing on a missed day. `push_devices` + the
    `daily-prompt-notify` Edge Function (cron-secret guarded, idempotent).
  - **Adjacent Diversity V1** — explainable neighbours only: same daily
    prompt, same fork origin, direct branches (`lib/adjacent.ts`,
    `services/adjacent.ts`). Self, subject and muted excluded (blocks by
    RLS), not-followed preferred with followed as fallback, stable tiebreak,
    no popularity inputs ever. Shown on post detail as "Another angle" /
    "Same prompt, another answer" (≤ 2) and absent when empty. Mix it up's
    outside slots take related posts first, then the Explore pool
    (`mergeOutsidePool`), leaving the F F O pattern and cursors unchanged.
    Semantic adjacency is a typed seam behind `SEMANTIC_ADJACENCY_ENABLED =
    false`; no provider exists and nothing may fake a score.
  - Still out of scope: search, trends, ranking, follower counts, DMs,
    stories, social notifications (likes/replies/follows), streaks, private
    accounts, ads, subscriptions, generative AI.

## Visual system (2026-09-16)

- Paper and ink with one accent (`src/constants/theme.ts`): warm off-white /
  charcoal / muted ultramarine, with a dark palette. No gradients, blur,
  glass, neon or cards. Hairlines only where a boundary means something.
- Type: system sans for reading and controls; Newsreader (serif) only for
  screen titles, chapter markers, endings and profile names (`Type.display`,
  `Type.chapter`, `Type.title`).
- The fork (`ForkLine`) is the only motif and appears only where the feed
  actually branches: selected intent, selected tab, end of chapter.
- Catch up / Mix are linear "paragraph" feeds; Explore is a spatial canvas
  (`ExploreCanvas`, `explore-layout.ts`, `explore-session.ts`): position and
  node size never encode popularity. Sessions are snapshots; opening a
  person's post is what counts as seen.
- Motion language (`Motion` in theme.ts): taps sink to 0.98 and spring back
  (`Tappable`), moves use the one spring, state changes fade with a 2-6pt
  shift; 150 / 200 / 400ms only; no bounce; everything respects Reduce
  Motion. Haptics (`decisionHaptic`) only at decisions: follow, publish,
  open a chapter, open a person. Never on likes or navigation.
- Photos take one of three frames (4:5, 1:1, 4:3). Missing avatars show
  `assets/images/default-avatar.png`, never an initial.
- Tabs stay Feed / Post / Profile, tab bar always visible on tab screens.
  Profile shows identity + Following + posts; everything about managing the
  account lives in Settings.

## Stack

Expo SDK 57 / React Native 0.86 / TypeScript (strict) / Expo Router (routes in
`src/app`) / Supabase (auth + Postgres + storage). No state-management library —
React context + local state is deliberate at this scale.

Expo APIs change between SDK versions: check https://docs.expo.dev/versions/v57.0.0/
before writing code against unfamiliar Expo modules.

## Layout

- `src/app` — screens/layouts only. `(auth)` group when signed out, `(tabs)` +
  `post/[id]` + `user/[id]` + `people/[list]` + `report` + `edit-profile` when
  signed in (guarded in `src/app/_layout.tsx`).
- `src/lib` — Supabase client (`supabase.ts`), auth context, relations
  context, feed intent storage, Mix composition (`feed-mix.ts`), formatting
  helpers.
- `src/services` — all database/storage calls. Screens never call `supabase` directly.
- `src/components` — small reusable UI (button, text-field, avatar, post-card, message-state).
- `src/constants/theme.ts` — neutral placeholder tokens; no branding yet.
- `supabase/schema.sql` — the schema as applied by hand up to 2026-09-16
  (baseline). Everything after lives in `supabase/migrations/*.sql`, one
  versioned, additive, production-safe file per change; never edit the
  baseline or an applied migration, add a new file. `npm run test:db` applies
  baseline + migrations to a throwaway local PostgreSQL and runs
  `supabase/tests/db.test.sql`.
- `src/i18n` — dictionary and provider. Every user-facing string, alert,
  empty state and accessibility label goes through it, in both languages.

## Conventions

- Strict TypeScript; avoid `any` (document it if truly unavoidable).
- Owner-only writes are enforced by RLS in the database, not just the UI.
- Secrets: only `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` via
  `.env` (gitignored). Never add the service_role key to this repo.
- Destructive actions (delete post/comment) always confirm first.
- Verify with `npx tsc --noEmit`, `npm run lint` and `npm test` before finishing
  a change; `npm run test:db` when a migration changes.
