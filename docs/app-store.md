# App Store Connect — listing and review notes

Everything below is ready to paste. Keep the app name and bundle id as they
are in App Store Connect (`Diverge`, `com.maochan.diverge-mvp`).

## Distribution

Request **Unlisted App Distribution** so the app is installable only via its
App Store link and never appears in search or charts:
https://developer.apple.com/contact/request/unlisted-app/

Fill in: app name Diverge, Apple ID 6809689660, reason: "Private social app
for an invited group of about 20 people (school project). Not intended for
general discovery." Submit the app for review first; the unlisted request is
processed alongside it.

## Version information

**Subtitle (30 chars max)**
A calm feed you choose yourself

**Promotional text (170 chars)**
Follow people on purpose, read in chapters that end, and explore everyone
outside your circle one person at a time. No ranking, no endless scroll.

**Description**
Diverge is a small social app built around one idea: you should decide what
reaches you.

Catch up shows only the people you chose to follow, newest first, in chapters
of twelve. When a chapter ends, it ends. Nothing loads unless you ask.

Mix it up keeps your circle in the middle and adds a few voices from outside
it, so your feed never closes over you.

Explore is not a feed. It is a space: everyone outside your circle who has
posted, laid out so you can see them all at once. Open one person's post,
then another, in any order you like. When you have met everyone, Diverge
tells you, and only shows more if you ask.

Diverge never learns from how long you look. Nothing you see is ranked by
likes, follower counts or attention. There are no follower numbers at all.
The only things that shape your feed are the choices you make: who you
follow, who you mute, and which kind of feed you pick.

Post up to four photos at a time. Block or report anyone from their profile
or from any post. Delete your account, and everything with it, whenever you
like.

**Keywords (100 chars)**
social,feed,friends,chapters,calm,explore,photos,follow,circle,quiet

**Support URL**
https://kyle1-2-3.github.io/diverge-legal/

**Marketing URL** (optional)
https://kyle1-2-3.github.io/diverge-legal/

**Privacy Policy URL**
https://kyle1-2-3.github.io/diverge-legal/privacy.html

**Copyright**
2026 Mao Tabata

**Category**
Primary: Social Networking

## Age rating questionnaire

All "None" except:
- Unrestricted Web Access: No
- User Generated Content: the app includes UGC (answer the follow-ups:
  moderation via block, report and account removal — see review notes).

Expected rating: 12+ (or 13+/17+ depending on Apple's current UGC answers).

## App Privacy (data collection)

Data collected, all "linked to the user", none used for tracking:
- Contact info → Email address (account creation, app functionality)
- User content → Photos, other user content (posts, comments)
- Identifiers → User ID (app functionality)
- Usage data: none. Diagnostics: none (no crash SDK). No advertising, no
  tracking, no third-party analytics.

## App Review information

**Sign-in required:** yes. Provide a demo account (create a fresh one before
submitting, e.g. reviewer@… with a strong password) that already follows one
or two accounts so Catch up, Mix it up and Explore all show content.

**Notes for the reviewer**
Diverge is a private social app for an invited group. User-generated content
is moderated as follows: users can block any account (their content becomes
mutually invisible immediately), mute any account, and report any post or
account from the "…" menu; reports go to the developer and are acted on
within 24 hours; users must agree to the Terms of Use and Privacy Policy at
sign-up; accounts can be deleted in-app from Settings → Delete account.
Contact: diverge.example@gmail.com.

## Screenshots (6.9" and 6.5" required)

Take from the simulator (iPhone 17 Pro Max for 6.9", iPhone 11 Pro Max /
iPhone XS Max for 6.5"), light mode, with the demo account:
1. Catch up — chapter 1 with two or three posts
2. Explore canvas — eight people
3. A person sheet open over the canvas
4. End of chapter card
5. Mix it up with an "Outside your circle" line
6. Profile

Command: `xcrun simctl io booted screenshot <file>.png`.

## Build

- Bump `version` in app.json when the listing changes (1.0.0 is fine for the
  first submission). `eas build --platform ios --profile production` then
  `eas submit` (auto-submit may sit in the free-tier queue; a manual submit
  usually goes first).
- In App Store Connect, pick the processed build under the version, fill in
  "What's New" (first release: "First release."), then Submit for Review.

## Status log

- 2026-09-19: Version 1.0 (build 10) submitted for review. App Store name
  is **Diverge Feed** ("Diverge" was taken). Age rating 13+. App Privacy
  published. Unlisted App Distribution request submitted the same day.
  Next: wait for the review email; after approval delete the test
  accounts (Feed Test, まお2, Riviewer) before inviting real testers.
- 2026-09-25: Unlisted App Distribution approved (App Store Connect shows
  the unlisted URL under Pricing and Availability).
- 2026-09-27: Version 1.0 (build 10) approved by App Review; status
  "Ready for Distribution". Unlisted link:
  https://apps.apple.com/us/app/diverge-feed/id6809689660
- 2026-10-11: Version 1.1 (build 12, 1.1.0) submitted for App Review (status 審査待ち). Changes: EN/JA localization, replies, Fork, daily prompt + opt-in reminder, Another angle, system Liquid Glass tab bar, composer as a sheet. URLs moved to maochann.github.io/diverge-legal; App Privacy gained Device ID (app functionality, linked, no tracking). Builds 11 and 12 are both in TestFlight; 12 is the one under review.
