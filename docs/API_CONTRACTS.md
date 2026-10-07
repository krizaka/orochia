---
title: Orochia API Reference
description: Every HTTP endpoint of the Orochia web app, with the access rule that guards it — extracted from the code.
---

# Orochia API Reference

> Generated from code by `scripts/generate-docs.mjs` — do not hand-edit.

## Endpoints (32)

| Method | Path | Access | Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/creators` | session · ADMIN | Creator accounts with their verification state; `?verified=false` lists the review queue. |
| `PATCH` | `/api/admin/creators/[id]` | session · ADMIN | Records the outcome of a creator's 18 U.S.C. § 2257 review. |
| `GET` | `/api/admin/overview` | session · ADMIN | Operator overview: money, catalogue and the three queues that need a human. |
| `GET` | `/api/admin/payouts` | session · ADMIN | Payout requests with their creator; `?status=` filters. |
| `PATCH` | `/api/admin/payouts/[id]` | session · ADMIN | Advances a payout. |
| `GET` | `/api/admin/reports` | session · ADMIN | Content reports, newest first; `?status=` filters. |
| `PATCH` | `/api/admin/reports/[id]` | session · ADMIN | Moves a report through triage (open → in review → resolved). |
| `POST` | `/api/auth/login` | public | Password login. |
| `POST` | `/api/auth/logout` | public | — |
| `GET` | `/api/auth/me` | public · session-aware | The signed-in account, or `user: null`. |
| `POST` | `/api/auth/register` | public | Creates a member or creator account (never an administrator) and signs it in. |
| `GET` | `/api/bunny/analytics` | session · ADMIN | Catalogue statistics for administrators, from the database. |
| `GET` | `/api/bunny/collections` | public · session-aware | Public collections, plus the signed-in creator's own private ones. |
| `POST` | `/api/bunny/collections` | session · CREATOR / ADMIN | Creates a collection owned by the signed-in creator. |
| `GET` | `/api/creator/payouts` | session · CREATOR | The signed-in creator's balance, lifetime earnings and payout history — from the ledger. |
| `POST` | `/api/creator/payouts` | session · CREATOR | Requests a payout; balances are checked and reserved atomically (requestPayout). |
| `GET` | `/api/creators/[username]` | public | — |
| `GET` | `/api/feed` | public | — |
| `GET` | `/api/health` | public | — |
| `POST` | `/api/legal/report` | public · session-aware | Content reports. |
| `GET` | `/api/me/dashboard` | session · ADMIN / CREATOR / MEMBER | — |
| `PUT` | `/api/me/profile` | session · ADMIN / CREATOR / MEMBER | Updates the signed-in user's own profile. |
| `GET` | `/api/metrics` | bearer token | Prometheus metrics, behind a bearer token (METRICS_AUTH_TOKEN). |
| `GET` | `/api/payments/gateways` | public | The gateways a buyer can pay through on this deployment. |
| `GET` | `/api/platform/treasury` | session · ADMIN | Platform revenue, computed from the ledger only (administrators). |
| `POST` | `/api/uploads` | session · ...rule.roles | — |
| `GET` | `/api/videos/[id]/details` | public | A video's public metadata; the stream itself is only served by /stream after authorisation. |
| `GET` | `/api/videos/[id]/stream` | public · session-aware | Authorises a viewer and returns a short-lived signed HLS URL (AGENTS.md §2.A). |
| `POST` | `/api/videos/create-upload-session` | public · session-aware | — |
| `POST` | `/api/videos/unlock-video` | session · MEMBER / CREATOR / ADMIN | Starts the purchase of a video unlock. |
| `POST` | `/api/webhooks/bunny` | signed webhook | — |
| `POST` | `/api/webhooks/payments/[gateway]` | signed webhook | Gateway payment notifications. |

## Database tables (11)

| Table | Drizzle export | Defined in |
| :--- | :--- | :--- |
| `compliance_reports` | `complianceReports` | `packages/db/src/schema/compliance.ts` |
| `contacts` | `contacts` | `packages/db/src/schema/contacts.ts` |
| `tips_ledger` | `tipsLedger` | `packages/db/src/schema/ledger.ts` |
| `payment_intents` | `paymentIntents` | `packages/db/src/schema/ledger.ts` |
| `payout_requests` | `payoutRequests` | `packages/db/src/schema/ledger.ts` |
| `playlists` | `playlists` | `packages/db/src/schema/playlists.ts` |
| `playlist_items` | `playlistItems` | `packages/db/src/schema/playlists.ts` |
| `users` | `users` | `packages/db/src/schema/users.ts` |
| `profiles` | `profiles` | `packages/db/src/schema/users.ts` |
| `videos` | `videos` | `packages/db/src/schema/videos.ts` |
| `video_access_grants` | `videoAccessGrants` | `packages/db/src/schema/videos.ts` |
