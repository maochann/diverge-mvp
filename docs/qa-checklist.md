# Manual QA: conversation phase

Run on the simulator (dev client) or a TestFlight build **after the four
migrations are applied** (docs/next-phase-setup.md §1). Two accounts are
needed for the social parts; `app_review` plus your own works. Items marked
(device) need a real iPhone.

## Language
1. Settings → Language → English: every screen, alert and empty state is English.
2. Settings → Language → 日本語: switch is immediate, no restart; check Feed, Post, Profile, Settings, a post's detail, the Explore canvas, an error alert (turn on airplane mode and pull to refresh).
3. Kill the app, reopen: still 日本語.
4. Settings → Language → System: follows the iPhone language (change it in iOS Settings → General → Language & Region; Japanese device shows 日本語, English device shows English).
5. Translation target: with the app in 日本語, an English post shows 翻訳を見る → Japanese text → 原文を見る. With the app in English, a Japanese post shows See translation → English.
6. Posts, usernames, display names, bios and comments never change with the app language.

## Replies
1. Open a post → write a comment → it appears as a root comment with a Reply link.
2. Tap Reply on it → composer shows "Replying to @name ×" → send → the thread shows "View 1 reply" → tap → the reply is indented under the root.
3. Send a second reply → "View 2 replies" / "Hide replies".
4. Tap Reply on a *reply* → composer says "Replying to @<that person>" → send → it lands under the same root, text prefixed with @name.
5. Delete a reply (trash icon on your own reply, confirmation) → it disappears; comment count on the card goes down.
6. From the other account: comment, then have the first account reply; delete the root comment from the other account → "This comment was deleted." stays with the reply under it. Delete the reply → both disappear.
7. Block the other account → their comments and the replies under them vanish from the thread.

## Fork
1. On any post (feed or detail) tap the branch glyph → New post opens with "Branching from @name" and the original's text; placeholder reads "Where does this take you?".
2. Write something and Publish → medium haptic (device) → the new post's detail shows "Branched from @name" above the text.
3. Pull-to-refresh the feed (Mix it up or Catch up as appropriate) → the fork appears as an ordinary post with the provenance line.
4. Tap "Branched from @name" → opens the original post.
5. The original's card now shows the branch glyph with "1"; a second fork from another account makes it "2".
6. Delete the original → the fork still exists; its provenance line is gone; the composer "×" removes the fork header without posting.
7. Block the original's author from the forking account → provenance line disappears on the fork; unblock → it returns.

## Daily prompt
1. Post tab → a bordered block "Today's prompt / “…”" with "Use this prompt". In 日本語: 今日のきっかけ / この問いで投稿.
2. Write and Publish without tapping it → an ordinary post with no prompt line.
3. Tap "Use this prompt" → label becomes "Answering this prompt" with ×; Publish → the post shows a small "Today's prompt · “…”" line.
4. From the second account, answer the same prompt → open either post → "Same prompt, another answer" lists the other person's post; tap → opens it.
5. Next day (or change the simulator date): a different prompt.

## Notification (device)
1. Settings → Daily prompt reminder → the switch is **off** by default; no permission prompt was shown at launch.
2. Turn it on → iOS asks for notification permission (first time only) → Allow → a Time row appears (7:00 PM).
3. Choose a time a few minutes ahead (5-minute steps) → wait for the next cron tick after that time → one notification arrives: title Diverge, body = today's prompt, in the app language. No badge on the icon.
4. Tap it → the app opens on New post with the prompt already selected.
5. Turn the switch off → nothing arrives the next day.
6. Turn it on, deny permission in iOS → alert "Notifications are off for Diverge" with "Open Settings".
7. Same device, same day: no second notification even if the time is changed again.

## Adjacent
1. A post that answers today's prompt, with another account's answer existing → "Same prompt, another answer" (one or two posts) under the post.
2. A fork, with a sibling fork from the same original → "Another angle" with "From the same idea, another direction"; the original shows "A branch from this post".
3. Block the author of a candidate → it disappears from the section.
4. Mute the author of a candidate → it disappears from the section.
5. A plain post with no prompt and no forks → no section at all (nothing fake).

## Feed regression
1. Catch up: followed people's posts newest first; own posts absent; empty state when following nobody.
2. Mix it up: F F O pattern; if a followed post answers today's prompt and someone outside answered it too, that answer is among the outside posts; otherwise the Explore pool as before.
3. Explore: canvas, tap a person → sheet → View profile → Follow → person moves inside on the next session.
4. Chapter: 12 posts, "See another chapter" (次の章を見る), "You're caught up" (ここまで追いつきました) when nothing older.
5. Snapshot: post from the second account mid-session → it does not appear until pull-to-refresh.
6. Pull-to-refresh: fork draws, session restarts at chapter 1.
7. Likes, delete post, report, mute, block, 4-photo HEIC post, profile edit, password reset, account deletion, dark mode: unchanged.
