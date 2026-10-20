---
title: Media pipeline
nav: Media pipeline
description: Direct-to-Bunny uploads, encoding and signed playback.
---

# Media Pipeline

Video never passes through the Orochia servers: the browser edits it, sends it straight to **Bunny Stream** over Tus,
Bunny encodes it and reports back through a signed webhook, and every play is a short-lived signed URL issued only
after the app has decided the viewer may watch.

---

## 1. Edit in the browser (optional)

Before an upload the creator can open the editor — trim with a filmstrip and two handles, speed 0.5–2×, 14 looks,
brightness / contrast / colour, crop to 9:16 or 1:1 by dragging the picture, sound volume up to 200 %, fades, noise
reduction and a music track mixed in. The preview is live (CSS, Web Audio); **Apply** renders the exact result with
**ffmpeg.wasm** on the device (H.264 / AAC MP4, 1080 px on the short side at most). Nothing is uploaded to do it.

Editing is non-destructive: the original stays on the device and reopens with its last settings. **Stories** are always
vertical 9:16 and at most 60 seconds — a story clip goes through the editor before it can be shared.

**Drafts.** *Save draft* keeps the original at Bunny (drafts collection, sent once over Tus), the settings and the form
in `video_drafts` and the music privately in storage, so the edit continues on any device. Saving again only updates
the settings. A draft is removed with its files when published, deleted, or after `MEDIA_DRAFT_RETENTION_DAYS` (30).

## 2. Limits

One table, `packages/media/src/limits.ts`, read by the browser and the server:

| What | Size | Length |
| :--- | :--- | :--- |
| Video | 4 GB | 3 hours |
| Story clip | 250 MB | 60 seconds |
| Draft original (what the editor opens) | 400 MB | — |
| Draft music | 25 MB | — |

The browser refuses before sending; the upload session refuses a larger declared size; the webhook reads the encoded
length and deletes at Bunny a video or story longer than allowed (status FAILED). These are hard ceilings: the
deployment can lower them (`ABUSE_QUOTA_VIDEO_MAX_MB`, `ABUSE_QUOTA_VIDEO_MAX_MINUTES`, `ABUSE_QUOTA_STORY_MAX_MB`, `ABUSE_QUOTA_DRAFT_MAX_MB`),
never raise them — and every upload also has to fit the storage quotas of §6.

## 3. Direct-to-Bunny Tus upload

```sequence
participant creator: @orochia-web
participant api: @orochia-api
participant db: @postgresql
participant bunny: @bunny-stream

creator -> api: POST /api/videos/create-upload-session (title, visibility, size…)
api -> api: verified creator (2257) · limits · rate limit
api -> bunny: create the video (in MEDIA_STREAM_COLLECTION_ID)
api -> api: Tus signature = sha256(libraryId + apiKey + expires + guid)
api -> db: videos row, status PENDING_UPLOAD
api --> creator: tusEndpoint and the signed headers
creator -> bunny: Tus upload, resumable chunks
```

Story videos (`/api/stories/upload-session`) and draft originals (`/api/me/drafts`) take the same path into their own
collections.

## 4. Encoding webhook

`POST /api/webhooks/bunny` — signature v1 (HMAC-SHA256 over the raw body with the library's Read-Only key,
`MEDIA_STREAM_WEBHOOK_SECRET`), compared in constant time.

| Bunny status | Orochia |
| :--- | :--- |
| 0 queued · 1 processing · 2 encoding · 4 resolution finished · 6–7 presigned upload started / finished | `PROCESSING` |
| 3 finished | `READY` — length, renditions and thumbnail read from the Stream API |
| 5 failed · 8 presigned upload failed | `FAILED` |
| 9–10 captions / title generated | ignored |

Events can arrive late, twice or out of order: a READY video never goes back to PROCESSING, and an event that changes
nothing is ignored. The GUID finds a video, else a story (its 24 hours start at READY), else a draft.

### When the webhook never comes (stories)

A library without a webhook URL, an app Bunny cannot reach (`localhost`, a second environment on the same library) or a
lost delivery used to leave a story PENDING_UPLOAD forever — invisible, even to its author. Now:

- **The author always sees their story.** The web rail asks `/api/stories?pending=1`: the author's own video stories
  come with `state: "processing"` (badge, no playback, no view counted) or `"failed"`, and the rail refreshes every
  10 s until the story is playable. Other viewers only ever receive READY stories.
- **Reconciliation** (`reconcileStoryVideos`, `lib/stories.ts`): each rail request asks the Stream API
  (`GET /videos/{guid}`) about video stories unsettled for more than 20 s — the viewer's own before answering, everyone
  else's after the response — and applies the answer through the same `settleStoryVideo` as the webhook (length check,
  READY, 24 hours from then). A story is claimed before the call (its `updated_at` moves), so instances never ask twice.
  The API numbers states differently from the webhook: 0 created · 1–3, 7, 8 processing · 4 finished · 5–6 failed
  (`mapBunnyApiStatusToOrochia`); a video Bunny no longer has, or holds no bytes for after the 2-hour Tus window, fails.

### When the webhook never comes (videos)

Same catch-up for videos (`reconcileVideos`, `lib/video-reconcile.ts`): a creator's page asks the Stream API about their
videos that are unsettled, or READY without a poster, and applies the answer as the webhook would (poster, preview,
length, renditions, READY/FAILED, quota hold). A video whose id is not a Bunny GUID (seed placeholders) holds no media
and is never asked about. A video polled by its id (`GET /api/videos/<id>/details`) while still PENDING_UPLOAD or
PROCESSING is reconciled on that read — one video, not the creator's list — so an upload never waits for a dashboard visit.

## 5. Signed playback

The library has **CDN token authentication** on and only allows the app's domains, so an unsigned URL answers 403.
The pull zone does **not** block requests without a Referer: a native player (iOS, Android) sends none, and the signature, not the header, is what lets a request in (an unsigned URL is 403 whatever the Referer; a signed one from a foreign Referer is 403 too). `node scripts/media-zone-policy.mjs check --zone <pull-zone-id>` (and `apply`) holds that policy, with `MEDIA_ACCOUNT_API_KEY` in the environment (krizaka/orochia#69).
After `evaluateVideoAccess` allows the viewer, `/api/videos/[id]/stream` signs a token for the video's directory,
valid **300 seconds**:

```text
https://{hostname}/bcdn_token={token}&expires={expires}&token_path=%2F{guid}%2F/{guid}/playlist.m3u8
token = base64url(sha256(tokenAuthKey + "/{guid}/" + expires + "token_path=/{guid}/"))
```

The token is in the path, not the query, because HLS players request renditions and segments by relative URL — the
path prefix is kept, a query string would be dropped. Thumbnails and preview animations are signed one file at a time
(`?token=…&expires=…`, 6-hour windows), which never opens the renditions.

## 6. Storage quotas

Bunny bills what it stores, so nothing is uploaded without fitting a budget: the platform's, and the creator's plan.

### What Bunny can tell us (study)

| Source | Call | What it gives | Notes |
| :--- | :--- | :--- | :--- |
| Stream API (library key) | `GET /library/{id}/videos/{guid}` | `storageSize` (bytes, every rendition and the original), `length` (s) | One video; read by the webhook at READY |
| Stream API (library key) | `GET /library/{id}/videos?page=&itemsPerPage=1000` | the same for every video, paged | One request per 1 000 videos — the reconciliation's input |
| Stream API (library key) | `GET /library/{id}/statistics` | views, watch time, countries | No storage figure |
| Account API (account key) | `GET https://api.bunny.net/videolibrary/{id}` | `StorageUsage`, `TrafficUsage` (whole library) | Refreshed by Bunny periodically, not in real time |
| Account API (account key) | `GET https://api.bunny.net/storagezone/{id}` | `StorageUsed`, `FilesStored` (the media zone) | Same: billing figures, periodic |
| Storage API (zone key) | `GET https://{region}.storage.bunnycdn.com/{zone}/{path}/` | `Length` of each object in one folder | No recursive total: a full walk is one call per folder |

The calls are not billed, but they are rate-limited, slow compared with a query, and the account totals lag. Asking
Bunny at every upload would make each upload depend on Bunny's API being up and still read stale totals; and Tus does
not stop a client from sending more bytes than it declared, so the declared size cannot be trusted alone either.

**Decision: the database is the source of truth, reconciled with Bunny.**

1. **At the upload session** (`/api/videos/create-upload-session`, `/api/stories/upload-session`, `/api/me/drafts`), *before*
   the Tus signature: `assertUploadAllowed` (`lib/storage-usage.ts`, rules in `lib/quotas.ts`) adds the declared size
   (and length, when the browser read it) to the creator's usage and the platform's, checks the per-file maximum, the
   plan, the cap, the uploads of the day and those in progress. A refusal is **413** (`FILE_TOO_LARGE`, `VIDEO_TOO_LONG`,
   `CREATOR_STORAGE_FULL`, `CREATOR_MINUTES_FULL`, `PLATFORM_STORAGE_FULL`, `PLATFORM_MINUTES_FULL`) or **429** with
   `Retry-After` (`UPLOADS_PER_DAY`, `CONCURRENT_UPLOADS`); the row records the declared size (`storage_bytes`).
2. **At the end of encoding** (webhook, or the stories' catch-up): the real `storageSize` and length replace the declared
   ones. If the creator's plan or the platform's cap is now exceeded, the file is **HELD** (`video_status` HELD): kept,
   shown to nobody, listed for its author as "On hold — storage full", and the creator is notified (`storageHeld`).
   **Nothing is deleted for a quota.** Held files go online by themselves when space is freed (a draft or video
   deleted, a story withdrawn, a larger plan, a reconciliation): `releaseHeld`.
3. **At deletion**: a draft's row (and its Bunny file) goes; a video or story withdrawn by its creator stops counting
   for them — its file stays at Bunny for the record (§3.D) and still counts for the platform.
4. **Reconciliation** (`lib/storage-reconcile.ts`): `npm run quota:reconcile`, `POST /api/admin/storage`, and the
   background loop every `ABUSE_QUOTA_RECONCILE_INTERVAL_MINUTES` (360). It lists the library, corrects every row's bytes,
   zeroes the rows whose video Bunny no longer has, counts the **orphans** (videos at Bunny no row knows — abandoned
   sessions, manual uploads, another environment sharing the library) and adds their bytes to the platform's usage,
   records a `storage_snapshots` row (with the account totals when `MEDIA_ACCOUNT_API_KEY` is set), releases held files
   that fit and re-checks the alerts.

### What counts

| | Creator's plan | Platform |
| :--- | :---: | :---: |
| Videos (not withdrawn, not failed; held included) | ✓ | ✓ |
| Withdrawn or taken-down videos | — | ✓ (still at Bunny) |
| Stories showing or encoding | ✓ | ✓ |
| Expired or withdrawn stories | — | ✓ (still at Bunny) |
| Draft originals | ✓ | ✓ |
| Orphans found by the last reconciliation | — | ✓ |
| Pictures (avatars, covers, thumbnails, story images) | per-file size + `ABUSE_QUOTA_IMAGE_UPLOADS_PER_DAY` | — (small; see the storage zone total) |

### Plans and alerts

A creator is on the `default` plan (`ABUSE_QUOTA_CREATOR_DEFAULT_GB`, `ABUSE_QUOTA_CREATOR_DEFAULT_MINUTES`); ADMIN accounts on
`ABUSE_QUOTA_ADMIN_PLAN` (`unlimited`). An operator gives an account a named plan of `ABUSE_QUOTA_PLANS`
(`PATCH /api/admin/storage/<userId>` `{ "plan": "pro" }`, `null` for the default); `unlimited` lifts the plan, never the
platform's cap. The platform alerts every ADMIN account once per threshold crossed (`ABUSE_QUOTA_ALERT_THRESHOLDS`, 80 and 95 %:
bell, push, e-mail, log); a creator is told once a week when they pass 90 % (`storageLow`). The dashboard and the
upload page show the gauge (`StorageMeter`, `GET /api/me/storage`); operators read `GET /api/admin/storage` (usage,
plans, largest accounts, last reconciliation, the state of the abuse defences).

## 7. The player's face and the watermark

Two layers, both code:

- **Our player is the face** (`apps/web/components/VideoPlayer.tsx`): `<video>` + hls.js over the signed HLS, its controls on
  `@krizaka/ui` tokens (the Orochia brand), a quiet `Spinner` over the poster while it loads (no sentence), a retry after
  three fatal stream errors, and the Orochia mark (`OrochiaLogo`, bottom-right, 40 % opacity, scaled with the player,
  lifted above the controls while they show, gone in full screen). The watch page signs the stream **on the server** with the
  page (`lib/stream-access.ts`, shared with `GET /api/videos/:id/stream`): no client round-trip before play.
- **Bunny's own embed player and the burned-in watermark** are the Stream library's settings, applied by
  `scripts/bunny-library.mjs` (tested by `scripts/bunny-library.test.mjs`; `MEDIA_ACCOUNT_API_KEY` from the environment):

  ```bash
  node scripts/bunny-library.mjs check                      # the drift between the library and the file, exit 1 if any
  node scripts/bunny-library.mjs apply                      # the player look (key colour = Orochia accent #7c3aed, controls, font): idempotent
  node scripts/bunny-library.mjs apply --watermark on       # + burn the Orochia mark into NEW encodes (PUT /watermark + position)
  node scripts/bunny-library.mjs apply --watermark off      # remove it (DELETE /watermark)
  ```

  Libraries: `orochia` (773325) is the only Stream library of the account. Orazaka's gallery and the brand films are
  Storage-zone files (krizaka-assets), not Stream: they have no player to configure.

**Burned-in watermark, what it is and is not.** Bunny burns it at encoding, for **new uploads only**, library-wide, into
every rendition (HLS and MP4): it also shows on the site's own playback and on every download or reshared copy, which is
the point (a clip that leaves keeps the mark, like TikTok's). Videos already encoded are never touched — enabling it
re-encodes nothing and costs nothing; removing it (`--watermark off`) does not clean videos encoded while it was on.
Bunny has one box per library, read as a share of each axis (`WATERMARK_BOX`: right/top 87 %, 10 × 10 %): the mark is the same mild oval (1.78 : 1) on a 9:16 and a 16:9 clip — per-orientation sizing is not in the API. To avoid a second mark over the burned one, the player skips its
overlay on videos created since `MEDIA_WATERMARK_SINCE` (`lib/watermark.ts`): set it to the day `--watermark on` was run, unset it
with `--watermark off`.

- **Recommendation**: on for production uploads (what leaves the site is branded), decided by the owner; on for dev from
  2026-10-19 for new uploads. **Turn it off**: `--watermark off`, unset `MEDIA_WATERMARK_SINCE`.
- **JIT encoding** (`JitEncodingEnabled`), checked 2026-10-20: a rendition of an old video that was never encoded is not produced on request (the CDN answers 404), and an old video's rendition missing from `availableResolutions` (480p of a pre-watermark clip) came back without the mark. No leak seen; never re-encode existing videos without a decision (cost).
- The dev app sets `MEDIA_WATERMARK_SINCE` in `deploy/digitalocean/app-spec.dev.yaml` (the `web` service). Mind `doctl apps update`: edit the service, not the `migrate` job.
