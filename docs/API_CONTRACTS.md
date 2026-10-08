---
title: Orochia API Reference
description: Every HTTP endpoint of the Orochia web app, with the access rule that guards it — extracted from the code.
---

# Orochia API Reference

> Generated from code by `scripts/generate-docs.mjs` — do not hand-edit.

## Endpoints (108)

| Method | Path | Access | Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/creators` | session · ADMIN | Creator accounts with their verification state; `?verified=false` lists the review queue. |
| `PATCH` | `/api/admin/creators/[id]` | session · ADMIN | Records the outcome of a creator's 18 U.S.C. § 2257 review. |
| `GET` | `/api/admin/documents` | session · ADMIN | A creator's 2257 document (`?ref=private/documents/<uuid>.<ext>`), for operators only; never cached. |
| `GET` | `/api/admin/overview` | session · ADMIN | Operator overview: money, catalogue and the three queues that need a human. |
| `GET` | `/api/admin/payouts` | session · ADMIN | Payout requests with their creator; `?status=` filters. |
| `PATCH` | `/api/admin/payouts/[id]` | session · ADMIN | Advances a payout. |
| `GET` | `/api/admin/reports` | session · ADMIN | Content reports, newest first; `?status=` filters. |
| `PATCH` | `/api/admin/reports/[id]` | session · ADMIN | Moves a report through triage (open → in review → resolved). |
| `GET` | `/api/admin/users` | session · ADMIN | Every account (filter by `?role=`, `?suspended=`, `?q=`): role, verification and suspension state. |
| `PATCH` | `/api/admin/users/[id]` | session · ADMIN | Suspends an account (it can no longer sign in, and its open sessions are refused on their next request), reinstates it, or changes its role. |
| `GET` | `/api/admin/videos` | session · ADMIN | The catalogue for moderation: every video with its creator, state and open reports; `?state=removed` lists takedowns. |
| `PATCH` | `/api/admin/videos/[id]` | session · ADMIN | Takes a video down (DMCA, terms, a confirmed report) with a recorded reason, or restores it. |
| `POST` | `/api/auth/forgot-password` | public | E-mails a password-reset link (1 h) to the address, if an active account uses it. |
| `POST` | `/api/auth/login` | public | Password login. |
| `POST` | `/api/auth/logout` | public | — |
| `GET` | `/api/auth/me` | public | The signed-in account (with whether its e-mail is verified), or `user: null`. |
| `GET` | `/api/auth/oauth/[provider]/callback` | public | The provider's redirect: checks the state, exchanges the code, then signs in (linked account or same verified address) or sends a new person to complete their account. |
| `GET` | `/api/auth/oauth/[provider]/start` | public | Sends the browser to the provider's consent page (state + PKCE kept in a signed 10-minute cookie). |
| `POST` | `/api/auth/oauth/complete` | public | Creates the account of a new Google / Facebook sign-in after the person certifies 18+ and accepts the terms. |
| `GET` | `/api/auth/oauth/pending` | public | The provider sign-in waiting to become an account: what the completion form can prefill. |
| `GET` | `/api/auth/providers` | public | The sign-in providers this deployment offers (only those whose keys are configured). |
| `POST` | `/api/auth/register` | public | Creates an account (a member — creators are opened later, never an administrator), signs it in and e-mails the link that verifies its address — until then the account can do nothing else. |
| `POST` | `/api/auth/resend-verification` | public | E-mails a new verification link to the signed-in account (the previous link stops working). |
| `POST` | `/api/auth/reset-password` | public | Sets a new password with the link's one-time token (1 h). |
| `POST` | `/api/auth/verify-email` | public | Verifies an e-mail address with the link's one-time token (48 h); refreshes the session of that account. |
| `GET` | `/api/bunny/analytics` | session · ADMIN | Catalogue statistics for administrators, from the database. |
| `POST` | `/api/contacts` | session · MEMBER / CREATOR / ADMIN | Sends a contact request (accepted at once when the other person already asked). |
| `DELETE` | `/api/contacts/[id]` | session · MEMBER / CREATOR / ADMIN | Removes a contact or withdraws a request (either side). |
| `PATCH` | `/api/contacts/[id]` | session · MEMBER / CREATOR / ADMIN | Accepts or rejects a request addressed to you, or blocks the other person. |
| `GET` | `/api/conversations` | session · ADMIN / CREATOR / MEMBER | Lists the signed-in user's active direct conversations. |
| `POST` | `/api/conversations` | session · ADMIN / CREATOR / MEMBER | Starts or retrieves a conversation with a specified user. |
| `GET` | `/api/conversations/[id]/messages` | session · ADMIN / CREATOR / MEMBER | Lists messages in a conversation and marks unread messages as read. |
| `POST` | `/api/conversations/[id]/messages` | session · ADMIN / CREATOR / MEMBER | Sends a direct message in a conversation. |
| `GET` | `/api/conversations/stream` | public | Realtime Server-Sent Events (SSE) stream for instant direct messages and notifications. |
| `GET` | `/api/creator/payouts` | session · CREATOR | The signed-in creator's balance, lifetime earnings and payout history — from the ledger. |
| `POST` | `/api/creator/payouts` | session · CREATOR | Requests a payout; balances are checked and reserved atomically (requestPayout). |
| `GET` | `/api/creators/[username]` | public · session-aware | A creator's public page: profile, videos, the collections you may open and, signed in, how you relate to them. |
| `DELETE` | `/api/creators/[username]/follow` | session · MEMBER / CREATOR / ADMIN | Unfollows a creator. |
| `POST` | `/api/creators/[username]/follow` | session · MEMBER / CREATOR / ADMIN | Follows a creator; the follow stays PENDING until the creator approves it. |
| `GET` | `/api/feed` | public | The public feed and the explore search (`?q=`, `?tag=`, paginated); with the featured creator and popular tags. |
| `GET` | `/api/health` | public | — |
| `POST` | `/api/legal/report` | public · session-aware | Content reports. |
| `POST` | `/api/me/become-creator` | session · MEMBER / CREATOR / ADMIN | Opens a creator space for a member: the account becomes CREATOR, pending its 18 U.S.C. § 2257 review (uploads open once an operator verifies it). |
| `GET` | `/api/me/blocks` | session · ADMIN / CREATOR / MEMBER | Lists the accounts blocked by the signed-in user. |
| `GET` | `/api/me/dashboard` | session · ADMIN / CREATOR / MEMBER | — |
| `GET` | `/api/me/drafts` | session · CREATOR / ADMIN | Your editor drafts (newest first), with a short-lived link to each original clip; expired ones are removed. |
| `POST` | `/api/me/drafts` | session · CREATOR / ADMIN | Keeps an edit as a draft: records its settings and returns a Tus session to send the original clip straight to Bunny. |
| `DELETE` | `/api/me/drafts/[id]` | session · CREATOR / ADMIN | Deletes one of your drafts with its clip and music. |
| `GET` | `/api/me/drafts/[id]` | session · CREATOR / ADMIN | One of your drafts, with a short-lived link to its original clip. |
| `PATCH` | `/api/me/drafts/[id]` | session · CREATOR / ADMIN | Saves new edit settings or form values on a draft (the clip is not sent again); it is kept longer. |
| `DELETE` | `/api/me/drafts/[id]/music` | session · CREATOR / ADMIN | Removes the music track of a draft. |
| `GET` | `/api/me/drafts/[id]/music` | session · CREATOR / ADMIN | The music track of one of your drafts (private: served to you only). |
| `PUT` | `/api/me/drafts/[id]/music` | session · CREATOR / ADMIN | Keeps (or replaces) the music track of a draft — MP3, M4A, AAC, WAV or OGG up to 25 MB. |
| `POST` | `/api/me/drafts/[id]/uploaded` | session · CREATOR / ADMIN | Tells that a draft's original clip is fully sent, so it can be opened again before Bunny finishes processing. |
| `PATCH` | `/api/me/followers/[id]` | session · CREATOR | A creator approves a follower (opening followers-only videos to them) or removes them. |
| `GET` | `/api/me/identities` | session · ADMIN / CREATOR / MEMBER | Lists the external OAuth providers linked to the signed-in account. |
| `DELETE` | `/api/me/identities/[id]` | session · ADMIN / CREATOR / MEMBER | Unlinks a connected OAuth provider identity from the signed-in account. |
| `GET` | `/api/me/invitations` | session · ADMIN / CREATOR / MEMBER | Lists invitations sent by the signed-in user. |
| `POST` | `/api/me/invitations` | session · ADMIN / CREATOR / MEMBER | Sends an invitation to join Orochia to a friend or collaborator. |
| `GET` | `/api/me/lists` | session · MEMBER / CREATOR / ADMIN | Your reusable audience lists (private to you), with their size. |
| `POST` | `/api/me/lists` | session · MEMBER / CREATOR / ADMIN | Creates an audience list (names are unique per account). |
| `DELETE` | `/api/me/lists/[id]` | session · MEMBER / CREATOR / ADMIN | Deletes one of your lists; the videos and collections it opened close to its members. |
| `PATCH` | `/api/me/lists/[id]` | session · MEMBER / CREATOR / ADMIN | Renames one of your lists. |
| `DELETE` | `/api/me/lists/[id]/members` | session · MEMBER / CREATOR / ADMIN | Removes someone from one of your lists (`?userId=`): what the list opened closes to them. |
| `GET` | `/api/me/lists/[id]/members` | session · MEMBER / CREATOR / ADMIN | The people in one of your lists. |
| `POST` | `/api/me/lists/[id]/members` | session · MEMBER / CREATOR / ADMIN | Adds an account to one of your lists by username (idempotent; the list stays private). |
| `GET` | `/api/me/network` | session · MEMBER / CREATOR / ADMIN | Your followers, the creators you follow, your contacts and pending requests. |
| `GET` | `/api/me/profile` | session · ADMIN / CREATOR / MEMBER | Reads the signed-in user's own profile and settings. |
| `PUT` | `/api/me/profile` | session · ADMIN / CREATOR / MEMBER | Updates the signed-in user's own profile and preferences. |
| `GET` | `/api/me/stories` | session · CREATOR / ADMIN | Your stories of the last 30 days — live, encoding or expired — with their figures. |
| `GET` | `/api/metrics` | bearer token | Prometheus metrics, behind a bearer token (METRICS_AUTH_TOKEN). |
| `GET` | `/api/payments/gateways` | public | The gateways a buyer can pay through on this deployment. |
| `GET` | `/api/platform/treasury` | session · ADMIN | Platform revenue, computed from the ledger only (administrators). |
| `GET` | `/api/playlists` | session · MEMBER / CREATOR / ADMIN | Your playlists, most recently changed first. |
| `POST` | `/api/playlists` | session · MEMBER / CREATOR / ADMIN | Creates a playlist. |
| `DELETE` | `/api/playlists/[id]` | session · MEMBER / CREATOR / ADMIN | Deletes a playlist (owner only). |
| `GET` | `/api/playlists/[id]` | public · session-aware | A collection and its videos, for a viewer its permission admits (others get a 404). |
| `PATCH` | `/api/playlists/[id]` | session · MEMBER / CREATOR / ADMIN | Renames a collection, edits its description or who may open it (owner only). |
| `DELETE` | `/api/playlists/[id]/items` | session · MEMBER / CREATOR / ADMIN | Removes a video from a playlist (owner only). |
| `POST` | `/api/playlists/[id]/items` | session · MEMBER / CREATOR / ADMIN | Adds a video at the end of a playlist (owner only, idempotent). |
| `GET` | `/api/playlists/shared` | session · MEMBER / CREATOR / ADMIN | Collections other accounts invited you to. |
| `GET` | `/api/reference/content-ratings` | public | Reference content classifications and age ratings (Kids Safe, General, Teens, Mature, Adult). |
| `GET` | `/api/reference/presets` | public | Default avatar and banner presets users can choose without uploading custom files. |
| `GET` | `/api/search` | public | — |
| `GET` | `/api/stories` | public · session-aware | The stories rail: one ring per creator with live stories you may see (yours first, then unseen), signed for you. |
| `POST` | `/api/stories` | session · CREATOR / ADMIN | Publishes an image story (24 h) from an image stored by /api/uploads (category "stories"); verified creators only. |
| `DELETE` | `/api/stories/[id]` | session · CREATOR / ADMIN | Withdraws a story: its creator or an operator. |
| `DELETE` | `/api/stories/[id]/like` | session · MEMBER / CREATOR / ADMIN | Removes your like (idempotent). |
| `POST` | `/api/stories/[id]/like` | session · MEMBER / CREATOR / ADMIN | Likes a story you may see (idempotent). |
| `POST` | `/api/stories/[id]/view` | public · session-aware | Counts a view of a story you may see — once per viewer, never the creator's own. |
| `POST` | `/api/stories/upload-session` | session · CREATOR / ADMIN | Starts a video story: records it and returns a Tus session straight to Bunny (stories collection). |
| `POST` | `/api/uploads` | session · role depends on the request | Stores an avatar (any account), a thumbnail, a story image or a 2257 document (creators); size and type checked per kind. |
| `DELETE` | `/api/users/[username]/block` | session · ADMIN / CREATOR / MEMBER | Unblocks a previously blocked user. |
| `POST` | `/api/users/[username]/block` | session · ADMIN / CREATOR / MEMBER | Blocks or unblocks a user: toggles block state on POST. |
| `DELETE` | `/api/videos/[id]` | session · CREATOR | The creator deletes their video. |
| `PATCH` | `/api/videos/[id]` | session · CREATOR | The creator edits their video: title, description, visibility, unlock price, tags, comments open. |
| `GET` | `/api/videos/[id]/comments` | public · session-aware | The comments of a video you may watch, oldest first; removed ones keep their place without text. |
| `POST` | `/api/videos/[id]/comments` | session · MEMBER / CREATOR / ADMIN | Comments on a video you may watch, or replies to one of its comments. |
| `DELETE` | `/api/videos/[id]/comments/[commentId]` | session · MEMBER / CREATOR / ADMIN | Removes a comment: its author, the video's creator or an operator. |
| `GET` | `/api/videos/[id]/details` | public · session-aware | A video's public metadata and figures (and whether you liked it); the stream is only served by /stream. |
| `DELETE` | `/api/videos/[id]/like` | session · MEMBER / CREATOR / ADMIN | Removes your like (idempotent). |
| `POST` | `/api/videos/[id]/like` | session · MEMBER / CREATOR / ADMIN | Likes a video you may watch (idempotent). |
| `POST` | `/api/videos/[id]/shares` | public · session-aware | Counts a share of a video you may watch; the shared link still enforces the video's access. |
| `GET` | `/api/videos/[id]/stream` | public · session-aware | Authorises a viewer and returns a short-lived signed HLS URL (AGENTS.md §2.A). |
| `POST` | `/api/videos/create-upload-session` | public · session-aware | — |
| `POST` | `/api/videos/unlock-video` | session · MEMBER / CREATOR / ADMIN | Starts the purchase of a video unlock. |
| `POST` | `/api/webhooks/bunny` | signed webhook | Bunny Stream encoding events (https://bunny.net/docs/stream/webhooks), signed v1 with the library's Read-Only API key (BUNNY_WEBHOOK_SECRET). |
| `POST` | `/api/webhooks/payments/[gateway]` | signed webhook | Gateway payment notifications. |

## Database tables (34)

| Table | Drizzle export | Defined in |
| :--- | :--- | :--- |
| `audience_lists` | `audienceLists` | `packages/db/src/schema/audiences.ts` |
| `audience_list_members` | `audienceListMembers` | `packages/db/src/schema/audiences.ts` |
| `video_viewers` | `videoViewers` | `packages/db/src/schema/audiences.ts` |
| `video_audience_lists` | `videoAudienceLists` | `packages/db/src/schema/audiences.ts` |
| `playlist_audience_lists` | `playlistAudienceLists` | `packages/db/src/schema/audiences.ts` |
| `auth_identities` | `authIdentities` | `packages/db/src/schema/auth-identities.ts` |
| `auth_tokens` | `authTokens` | `packages/db/src/schema/auth-tokens.ts` |
| `compliance_reports` | `complianceReports` | `packages/db/src/schema/compliance.ts` |
| `contacts` | `contacts` | `packages/db/src/schema/contacts.ts` |
| `follows` | `follows` | `packages/db/src/schema/contacts.ts` |
| `video_drafts` | `videoDrafts` | `packages/db/src/schema/drafts.ts` |
| `video_views` | `videoViews` | `packages/db/src/schema/engagement.ts` |
| `video_likes` | `videoLikes` | `packages/db/src/schema/engagement.ts` |
| `video_comments` | `videoComments` | `packages/db/src/schema/engagement.ts` |
| `video_shares` | `videoShares` | `packages/db/src/schema/engagement.ts` |
| `user_invitations` | `userInvitations` | `packages/db/src/schema/invitations.ts` |
| `tips_ledger` | `tipsLedger` | `packages/db/src/schema/ledger.ts` |
| `payment_intents` | `paymentIntents` | `packages/db/src/schema/ledger.ts` |
| `payout_requests` | `payoutRequests` | `packages/db/src/schema/ledger.ts` |
| `conversations` | `conversations` | `packages/db/src/schema/messaging.ts` |
| `direct_messages` | `directMessages` | `packages/db/src/schema/messaging.ts` |
| `blocked_users` | `blockedUsers` | `packages/db/src/schema/messaging.ts` |
| `payment_outbox` | `paymentOutbox` | `packages/db/src/schema/payment-outbox.ts` |
| `playlists` | `playlists` | `packages/db/src/schema/playlists.ts` |
| `playlist_items` | `playlistItems` | `packages/db/src/schema/playlists.ts` |
| `playlist_members` | `playlistMembers` | `packages/db/src/schema/playlists.ts` |
| `content_ratings` | `contentRatings` | `packages/db/src/schema/reference-data.ts` |
| `stories` | `stories` | `packages/db/src/schema/stories.ts` |
| `story_views` | `storyViews` | `packages/db/src/schema/stories.ts` |
| `story_likes` | `storyLikes` | `packages/db/src/schema/stories.ts` |
| `users` | `users` | `packages/db/src/schema/users.ts` |
| `profiles` | `profiles` | `packages/db/src/schema/users.ts` |
| `videos` | `videos` | `packages/db/src/schema/videos.ts` |
| `video_access_grants` | `videoAccessGrants` | `packages/db/src/schema/videos.ts` |
