---
title: Orochia API Reference
description: Every HTTP endpoint of the Orochia web app, with the access rule that guards it — extracted from the code.
---

# Orochia API Reference

> Generated from code by `scripts/generate-docs.mjs` — do not hand-edit.

## Endpoints (52)

| Method | Path | Access | Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/creators` | session · ADMIN | Creator accounts with their verification state; `?verified=false` lists the review queue. |
| `PATCH` | `/api/admin/creators/[id]` | session · ADMIN | Records the outcome of a creator's 18 U.S.C. § 2257 review. |
| `GET` | `/api/admin/overview` | session · ADMIN | Operator overview: money, catalogue and the three queues that need a human. |
| `GET` | `/api/admin/payouts` | session · ADMIN | Payout requests with their creator; `?status=` filters. |
| `PATCH` | `/api/admin/payouts/[id]` | session · ADMIN | Advances a payout. |
| `GET` | `/api/admin/reports` | session · ADMIN | Content reports, newest first; `?status=` filters. |
| `PATCH` | `/api/admin/reports/[id]` | session · ADMIN | Moves a report through triage (open → in review → resolved). |
| `GET` | `/api/admin/users` | session · ADMIN | Every account (filter by `?role=`, `?suspended=`, `?q=`): role, verification and suspension state. |
| `PATCH` | `/api/admin/users/[id]` | session · ADMIN | Suspends an account (it can no longer sign in, and its open sessions are refused on their next request), reinstates it, or changes its role. |
| `GET` | `/api/admin/videos` | session · ADMIN | The catalogue for moderation: every video with its creator, state and open reports; `?state=removed` lists takedowns. |
| `PATCH` | `/api/admin/videos/[id]` | session · ADMIN | Takes a video down (DMCA, terms, a confirmed report) with a recorded reason, or restores it. |
| `POST` | `/api/auth/login` | public | Password login. |
| `POST` | `/api/auth/logout` | public | — |
| `GET` | `/api/auth/me` | public · session-aware | The signed-in account, or `user: null`. |
| `POST` | `/api/auth/register` | public | Creates a member or creator account (never an administrator) and signs it in. |
| `GET` | `/api/bunny/analytics` | session · ADMIN | Catalogue statistics for administrators, from the database. |
| `GET` | `/api/bunny/collections` | public · session-aware | Public collections, plus the signed-in creator's own private ones. |
| `POST` | `/api/bunny/collections` | session · CREATOR / ADMIN | Creates a collection owned by the signed-in creator. |
| `POST` | `/api/contacts` | session · MEMBER / CREATOR / ADMIN | Sends a contact request (accepted at once when the other person already asked). |
| `DELETE` | `/api/contacts/[id]` | session · MEMBER / CREATOR / ADMIN | Removes a contact or withdraws a request (either side). |
| `PATCH` | `/api/contacts/[id]` | session · MEMBER / CREATOR / ADMIN | Accepts or rejects a request addressed to you, or blocks the other person. |
| `GET` | `/api/creator/payouts` | session · CREATOR | The signed-in creator's balance, lifetime earnings and payout history — from the ledger. |
| `POST` | `/api/creator/payouts` | session · CREATOR | Requests a payout; balances are checked and reserved atomically (requestPayout). |
| `GET` | `/api/creators/[username]` | public · session-aware | A creator's public page: profile, videos, public playlists and, signed in, how you relate to them. |
| `DELETE` | `/api/creators/[username]/follow` | session · MEMBER / CREATOR / ADMIN | Unfollows a creator. |
| `POST` | `/api/creators/[username]/follow` | session · MEMBER / CREATOR / ADMIN | Follows a creator; the follow stays PENDING until the creator approves it. |
| `GET` | `/api/feed` | public | The public feed and the explore search (`?q=`, `?tag=`, paginated); with the featured creator and popular tags. |
| `GET` | `/api/health` | public | — |
| `POST` | `/api/legal/report` | public · session-aware | Content reports. |
| `GET` | `/api/me/dashboard` | session · ADMIN / CREATOR / MEMBER | — |
| `PATCH` | `/api/me/followers/[id]` | session · CREATOR | A creator approves a follower (opening followers-only videos to them) or removes them. |
| `GET` | `/api/me/network` | session · MEMBER / CREATOR / ADMIN | Your followers, the creators you follow, your contacts and pending requests. |
| `PUT` | `/api/me/profile` | session · ADMIN / CREATOR / MEMBER | Updates the signed-in user's own profile. |
| `GET` | `/api/metrics` | bearer token | Prometheus metrics, behind a bearer token (METRICS_AUTH_TOKEN). |
| `GET` | `/api/payments/gateways` | public | The gateways a buyer can pay through on this deployment. |
| `GET` | `/api/platform/treasury` | session · ADMIN | Platform revenue, computed from the ledger only (administrators). |
| `GET` | `/api/playlists` | session · MEMBER / CREATOR / ADMIN | Your playlists, most recently changed first. |
| `POST` | `/api/playlists` | session · MEMBER / CREATOR / ADMIN | Creates a playlist. |
| `DELETE` | `/api/playlists/[id]` | session · MEMBER / CREATOR / ADMIN | Deletes a playlist (owner only). |
| `GET` | `/api/playlists/[id]` | public · session-aware | A playlist and its videos (private playlists are visible to their owner only). |
| `PATCH` | `/api/playlists/[id]` | session · MEMBER / CREATOR / ADMIN | Renames a playlist, edits its description or its privacy (owner only). |
| `DELETE` | `/api/playlists/[id]/items` | session · MEMBER / CREATOR / ADMIN | Removes a video from a playlist (owner only). |
| `POST` | `/api/playlists/[id]/items` | session · MEMBER / CREATOR / ADMIN | Adds a video at the end of a playlist (owner only, idempotent). |
| `POST` | `/api/uploads` | session · role depends on the request | Stores an avatar (any account), a thumbnail or a 2257 document (creators); size and type checked per kind. |
| `DELETE` | `/api/videos/[id]` | session · CREATOR | The creator deletes their video. |
| `PATCH` | `/api/videos/[id]` | session · CREATOR | The creator edits their video: title, description, visibility, unlock price, tags. |
| `GET` | `/api/videos/[id]/details` | public | A video's public metadata; the stream itself is only served by /stream after authorisation. |
| `GET` | `/api/videos/[id]/stream` | public · session-aware | Authorises a viewer and returns a short-lived signed HLS URL (AGENTS.md §2.A). |
| `POST` | `/api/videos/create-upload-session` | public · session-aware | — |
| `POST` | `/api/videos/unlock-video` | session · MEMBER / CREATOR / ADMIN | Starts the purchase of a video unlock. |
| `POST` | `/api/webhooks/bunny` | signed webhook | — |
| `POST` | `/api/webhooks/payments/[gateway]` | signed webhook | Gateway payment notifications. |

## Database tables (12)

| Table | Drizzle export | Defined in |
| :--- | :--- | :--- |
| `compliance_reports` | `complianceReports` | `packages/db/src/schema/compliance.ts` |
| `contacts` | `contacts` | `packages/db/src/schema/contacts.ts` |
| `follows` | `follows` | `packages/db/src/schema/contacts.ts` |
| `tips_ledger` | `tipsLedger` | `packages/db/src/schema/ledger.ts` |
| `payment_intents` | `paymentIntents` | `packages/db/src/schema/ledger.ts` |
| `payout_requests` | `payoutRequests` | `packages/db/src/schema/ledger.ts` |
| `playlists` | `playlists` | `packages/db/src/schema/playlists.ts` |
| `playlist_items` | `playlistItems` | `packages/db/src/schema/playlists.ts` |
| `users` | `users` | `packages/db/src/schema/users.ts` |
| `profiles` | `profiles` | `packages/db/src/schema/users.ts` |
| `videos` | `videos` | `packages/db/src/schema/videos.ts` |
| `video_access_grants` | `videoAccessGrants` | `packages/db/src/schema/videos.ts` |
