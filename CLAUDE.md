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

## Diverge features explicitly authorized by the user (2026-09-07)

Only these two may exist; everything else in the scope list above still
requires a new explicit instruction.

- **Finite Feed** — the feed is read in chapters of `CHAPTER_SIZE` posts with
  an explicit end card; no auto-load, no timers, no badges. Composite
  (created_at, id) cursor. Chapter numbers stay low-key. "End of chapter"
  (more exists) and "You're caught up" (nothing older) are distinct states.
- **Feed Intent** — a quiet picker at the top of the feed (Catch up / Mix it
  up / Explore). Today every intent returns the same chronological feed; the
  intent is plumbed through `fetchFeedChapter` so ranking can attach later,
  once there are enough users. Do not add ranking without a new instruction.

## Stack

Expo SDK 57 / React Native 0.86 / TypeScript (strict) / Expo Router (routes in
`src/app`) / Supabase (auth + Postgres + storage). No state-management library —
React context + local state is deliberate at this scale.

Expo APIs change between SDK versions: check https://docs.expo.dev/versions/v57.0.0/
before writing code against unfamiliar Expo modules.

## Layout

- `src/app` — screens/layouts only. `(auth)` group when signed out, `(tabs)` +
  `post/[id]` + `edit-profile` when signed in (guarded in `src/app/_layout.tsx`).
- `src/lib` — Supabase client (`supabase.ts`), auth context, formatting helpers.
- `src/services` — all database/storage calls. Screens never call `supabase` directly.
- `src/components` — small reusable UI (button, text-field, avatar, post-card, message-state).
- `src/constants/theme.ts` — neutral placeholder tokens; no branding yet.
- `supabase/schema.sql` — full schema + RLS; the only source of truth for the database.

## Conventions

- Strict TypeScript; avoid `any` (document it if truly unavoidable).
- Owner-only writes are enforced by RLS in the database, not just the UI.
- Secrets: only `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` via
  `.env` (gitignored). Never add the service_role key to this repo.
- Destructive actions (delete post/comment) always confirm first.
- Verify with `npx tsc --noEmit` and `npm run lint` before finishing a change.
