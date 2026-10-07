# Diverge MVP

A minimal social-network app for a private test group (~20 people). Built with
React Native, Expo, TypeScript, Expo Router, and Supabase. "Diverge" is a
temporary name — this codebase is a generic foundation with no product-specific
features yet.

## What's included

Since 2026-10-06 the app also has EN/JA localization, one-level replies, Fork
(branch a thought from a post), a daily prompt with an optional once-a-day
reminder, and "Another angle" (same prompt / same origin neighbours). See
`CLAUDE.md` for the rules behind each and `docs/next-phase-setup.md` for the
one-time setup they need.

- **Auth** — email/password sign-up, log in, log out, persisted sessions, clear error messages
- **Profiles** — unique username, display name, optional photo and bio; view and edit your own
- **Feed** — one shared feed of all users' posts, newest first, with pull-to-refresh and loading/empty/error states. No algorithm, no ranking, no personalization.
- **Posts** — text (up to 500 chars) plus one optional image; delete your own (with confirmation)
- **Likes** — like/unlike, live count, one like per user per post
- **Comments** — chronological comments on a post; delete your own (with confirmation)

## What's intentionally excluded

No follows, DMs, notifications, stories, search, recommendations, ads,
verification, or any other social-platform features — and no Diverge-specific
product concepts. This is a deliberately small foundation; features are added
only by explicit decision later. See `CLAUDE.md` for the standing scope rules.

## Requirements

- Node.js 20+ and npm
- The **Expo Go** app on your iPhone (App Store, free) — for development testing
- A free [Supabase](https://supabase.com) account

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → New project (free tier is fine).
2. Pick any name and a strong database password (you won't need the password day-to-day).
3. Wait for the project to finish provisioning.

### 3. Apply the database schema

1. In the Supabase dashboard, open **SQL Editor**.
2. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and run it.
3. This creates the `profiles`, `posts`, `likes`, and `comments` tables, the
   sign-up trigger, all Row Level Security policies, and the two public image
   buckets (`avatars`, `post-images`).

For a ~20-person private test you may also want: **Authentication → Sign In / Up →
Email** and turn **off** "Confirm email", so testers can log in immediately
without an email round-trip. (If you leave it on, the app shows a "confirm your
email" message after sign-up — both paths work.)

### 4. Configure environment variables

```bash
cp .env.example .env
```

Fill in the two values from **Project settings → API** in the Supabase dashboard:
the Project URL and the `anon` public key. The real `.env` is gitignored.
Never put the `service_role` key anywhere in this app.

### 5. Run the app

```bash
npx expo start
```

Scan the QR code with the iPhone camera to open the app in **Expo Go**.
Press `i` in the terminal to open the iOS simulator instead (requires Xcode).

## Checks

```bash
npx tsc --noEmit   # type checking
npm run lint       # ESLint via expo lint
```

There are no automated UI tests yet; features were verified by type checking and
linting. End-to-end behavior (sign-up → post → like → comment) should be
exercised manually against a real Supabase project.

## Current limitations

- Deleting a post or account does not remove its uploaded images from storage
  (orphaned files are harmless but accumulate).
- Images in the two storage buckets are public-read by URL (fine for a private
  test group; revisit before any wider release).
- The feed loads all posts at once — no pagination. Fine for ~20 users; add
  range-based pagination when volume grows.
- Likes/comments don't update in real time; the feed refreshes on focus and
  pull-to-refresh.
- No offline support.

## Recommended next step

Set up an Expo **development build** and EAS (`npx eas init`) so the app can be
distributed to the test group via TestFlight — Expo Go is for development only.
After that, pagination for the feed is the first scaling improvement worth making.
