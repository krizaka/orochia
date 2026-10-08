# Orochia — Deployment & Operations

## Requirements

| Variable | Required in production | Notes |
| :--- | :---: | :--- |
| `NODE_ENV=production` | ✓ | Enables strict configuration: no defaults, no demo mode. |
| `NEXT_PUBLIC_APP_URL` | ✓ | Public origin, used for payment return URLs and IPN callbacks. |
| `SESSION_SECRET` | ✓ | ≥ 32 random characters (`openssl rand -hex 32`). |
| `DATABASE_URL` | ✓ | PostgreSQL 16. |
| `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_HOSTNAME`, `BUNNY_STREAM_TOKEN_AUTH_KEY`, `BUNNY_WEBHOOK_SECRET` | ✓ | Video library, edge token auth and encode webhooks. |
| `BUNNY_STREAM_COLLECTION_ID`, `BUNNY_STREAM_STORIES_COLLECTION_ID`, `BUNNY_STREAM_DRAFTS_COLLECTION_ID` | — | Collections (UUIDs) new videos, story videos and the originals of editor drafts are filed in. Unset: the first falls back to none, the others to the first. |
| `PAYOUT_ENCRYPTION_KEY` | ✓ | Encrypts payout account details at rest (≥ 32 characters, `openssl rand -hex 32`). Keep it: changing it makes saved payout accounts unreadable. |
| `PAYMENTS_CREDITS_MODE=test` | dev / test | Adds a free "test top-up" to the wallet. Ignored on the public deployment (the one without `SEARCH_INDEXING=off`); credits are otherwise bought through a gateway. |
| `DRAFT_RETENTION_DAYS` (30), `DRAFTS_MAX_PER_USER` (20) | — | How long an editor draft is kept, and how many an account may keep. |
| `STORAGE_DRIVER=bunny`, `BUNNY_STORAGE_API_KEY`, `BUNNY_STORAGE_ZONE`, `BUNNY_PULL_ZONE_HOSTNAME` | ✓ | Avatars, thumbnails, 2257 documents (container disks are ephemeral). |
| `METRICS_AUTH_TOKEN` | ✓ | Bearer token for `/api/metrics`. |
| `DATABASE_CA_CERT` | managed DB | CA of a managed PostgreSQL (`${<db>.CA_CERT}` on App Platform): TLS verified against it. |
| `RESEND_API_KEY` or `MAILGUN_API_KEY` + `MAILGUN_DOMAIN` (+ `MAILGUN_API_URL`), `MAIL_FROM` | — | Transactional e-mail from `mg.orochia.com`: Resend when its key is set, Mailgun otherwise. Without either nothing is sent. |
| `COMPLIANCE_ALERT_EMAIL` | — | Receives every content report (`[URGENT]` for underage / non-consensual). |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`, `FACEBOOK_APP_ID` + `FACEBOOK_APP_SECRET` | — | Sign in with Google / Facebook — see *Sign-in providers*. A provider without both values is not offered. |
| `SEARCH_INDEXING=off` | dev / preview | Every page noindex, robots.txt disallows all: only production is indexed (build time). |
| `OROCHIA_OWNER_EMAIL`, `_USERNAME`, `_NAME`, `_PASSWORD` | recommended | The default user (owner, ADMIN), applied by the release job — see *Owner account*. |
| Gateway credentials | at least one | See `.env.example`. A gateway is offered only when **all** its variables are set. |

A missing required value makes the requests that need it answer **503** and logs the variable name — the
platform never runs on a placeholder secret.

## Gateway webhooks

| Gateway | Endpoint | Signature header |
| :--- | :--- | :--- |
| CCBill | `/api/webhooks/payments/ccbill` | `X-CCBill-Signature` (HMAC-SHA256 of the raw body, `CCBILL_WEBHOOK_SECRET`) |
| Segpay | `/api/webhooks/payments/segpay` | `X-Segpay-Signature` (HMAC-SHA256, `SEGPAY_SECRET_KEY`) |
| NowPayments | `/api/webhooks/payments/crypto` | `x-nowpayments-sig` (HMAC-SHA512 of the key-sorted body, `NOWPAYMENTS_IPN_SECRET`) |
| Stripe | `/api/webhooks/payments/stripe` | `Stripe-Signature` (v1, 300 s tolerance, `STRIPE_WEBHOOK_SECRET`) — events `checkout.session.*` |
| Bunny Stream | `/api/webhooks/bunny` | `X-BunnyStream-Signature` v1 (HMAC-SHA256 of the raw body, keyed with the library's Read-Only API key = `BUNNY_WEBHOOK_SECRET`) |

## DigitalOcean App Platform

One app per environment, one spec per app. Both build `deploy/docker/Dockerfile` and run a **PRE_DEPLOY job**
(`node migrate.cjs`) that applies `packages/db/drizzle` before every release.

| Environment | Spec | App | Branch | Database |
| :--- | :--- | :--- | :--- | :--- |
| dev | `deploy/digitalocean/app-spec.dev.yaml` | `orochia-dev` | `main` | App Platform dev database (PostgreSQL 16) |
| production | `deploy/digitalocean/app-spec.production.yaml` | `orochia` | `production` | managed PostgreSQL 16 cluster `orochia-pg`, created first |

```bash
brew install doctl && doctl auth init                                    # once, with a DO API token
doctl apps create --spec deploy/digitalocean/app-spec.dev.yaml           # once per environment
```

Then enter the `SECRET` values in the app (Settings → Environment Variables) **once** and redeploy. They are
stored, encrypted, in the app — not in the spec, not in git — and every push to the app's branch redeploys with
them (`deploy_on_push`). A spec file is only for creating the app or changing its structure (services, job,
database, the list of variables): `doctl apps update <APP_ID> --spec …` replaces the whole spec, and the
`SECRET` entries have no value in the file — check them in the app afterwards.

The spec has no Redis: rate limits are kept in memory per instance (`apps/web/lib/rate-limit.ts`), which holds for
a single instance. A shared store comes back before scaling out.

### Domain (orochia.com, DNS at Porkbun)

The specs declare the domains (`orochia.com` + `www` for production, `dev.orochia.com` for dev); DNS stays at
Porkbun. After `doctl apps create`, App Platform shows the target of each name (`<app>.ondigitalocean.app`):

| Porkbun record | Name | Value |
| :--- | :--- | :--- |
| `ALIAS` | *(apex)* `orochia.com` | the production app's hostname |
| `CNAME` | `www` | the production app's hostname |
| `CNAME` | `dev` | the dev app's hostname |

Remove Porkbun's URL forwarding and any parking `A`/`ALIAS` record on the same names first. The TLS certificate is
issued by App Platform once the records resolve.

### Sign-in providers (Google, Facebook)

OAuth 2 authorization code with PKCE, no SDK (`apps/web/lib/oauth.ts`). Register one redirect URI per environment:
`https://<domain>/api/auth/oauth/google/callback` and `…/facebook/callback`.

- **Google** — Google Cloud Console → APIs & Services → Credentials → *Create OAuth client ID* (Web application);
  authorised redirect URI as above; consent screen with the `openid`, `email`, `profile` scopes. Copy the client id
  and secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
- **Facebook** — developers.facebook.com → *Create app* (Consumer) → add *Facebook Login* → *Valid OAuth Redirect
  URIs* as above; permissions `email`, `public_profile`. App ID and secret go into `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`.
  Note: Meta's platform policies restrict adult services; check that your use is allowed before going live.

A provider sign-in lands in the account linked to it, or in the account whose address the provider verified (linked
then). A new person completes their account — username, 18+ certification, terms — before it is created.

### Owner account

The default user — the platform owner — comes from the environment of the release job:

| Variable | |
| :--- | :--- |
| `OROCHIA_OWNER_EMAIL` | turns the feature on |
| `OROCHIA_OWNER_USERNAME`, `OROCHIA_OWNER_NAME` | 3–30 `a-z0-9_`; display name |
| `OROCHIA_OWNER_PASSWORD` (SECRET) | needed to create the account (10+ characters); an existing account keeps its password |

On every release `migrate.cjs` applies the migrations, then creates or reactivates that account (ADMIN, age- and
2257-verified, not suspended). Nothing is deleted. Locally the seed does the same from `.env`, and
`npm run db:owner [-- --email … --username … --name "…"] [--reset-password]` applies it to any `DATABASE_URL`.

### Bunny Stream security

| Setting (library → Security) | Value |
| :--- | :--- |
| CDN token authentication | **on** — `BUNNY_STREAM_TOKEN_AUTH_KEY` is its key; every playback URL is signed for 300 s |
| Block direct url file access | on, with **Allowed domains** `orochia.com`, `*.orochia.com` (and `localhost` while developing) |
| Embed view token authentication | off — the app plays HLS itself, not Bunny's embedded player |
| Webhook | `https://<domain>/api/webhooks/bunny`. Bunny signs it (v1, HMAC-SHA256) with the library's **Read-Only API key**: that key is `BUNNY_WEBHOOK_SECRET` |
| Keep original files (library → Encoding) | **on** — an editor draft is reopened from its original (`/<guid>/original`, signed for its owner) |

Thumbnails and preview animations are on the same CDN, so they are signed too — one file per token
(`?token=…&expires=…`, 6-hour windows), which never opens the video's renditions.

### Storage zone (avatars, thumbnails, story images, drafts' music, 2257 documents)

`BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_API_KEY` (the zone's password), `BUNNY_STORAGE_ENDPOINT` (region host, default
`storage.bunnycdn.com` = Frankfurt) and `BUNNY_PULL_ZONE_HOSTNAME` (the pull zone connected to the storage zone). File
names are random UUIDs. 2257 documents are stored under `private/` with no public URL and are read by operators only,
through `GET /api/admin/documents?ref=…`; the music of editor drafts (`private/audio/`) is served to its owner only.
Add an edge rule on the storage pull zone that blocks `/private/*`.

The token is carried in the path (`/bcdn_token=…&token_path=/<guid>/…`) so renditions and segments, requested by
relative URL, are authorised too. New uploads are filed in the collection `BUNNY_STREAM_COLLECTION_ID`; who may
watch is decided by the app, never by Bunny collections.

### Upload limits and editor drafts

Limits live in one place, `packages/media/src/limits.ts`, read by the browser (checked before anything is sent) and
by the server: a video is at most **4 GB and 3 hours**, a story clip **250 MB and 60 seconds** (vertical 9:16, always
edited first), an editor draft's original **400 MB** (what the in-browser editor opens), its music **25 MB**. The
upload session refuses a larger declared size; Bunny's webhook reports the real length, and a video or story longer
than allowed is marked FAILED and deleted at Bunny — a client that lies about the size gains nothing.

A draft keeps the **original** clip at Bunny (drafts collection), the edit settings and the form in `video_drafts`,
and the music under `private/audio/` in storage. Saving it again only updates the settings. It is removed with its
files when published, deleted, or after `DRAFT_RETENTION_DAYS`.

### E-mail (Resend, mg.orochia.com)

The sending domain `mg.orochia.com` is declared in Resend; its records live at Porkbun under `mg`: DKIM
`TXT resend._domainkey.mg`, and `CNAME send.mg` / `CNAME rsend.mg` (as Resend lists them). Once Resend shows the domain
verified, set `RESEND_API_KEY` (SECRET) and `COMPLIANCE_ALERT_EMAIL` in the app. Mailgun (`MAILGUN_API_KEY` +
`MAILGUN_DOMAIN`) remains supported when no Resend key is set.

## Backups and factory reset

The admin console (**Platform & Database**) shows the deployment, the database (size, rows per table) and where its
migration history stands against the release.

- **Backups** — *Back up now* writes every table as gzipped JSON to private storage (`private/backups/` on Bunny Edge
  Storage; `.private-uploads/backups/` locally), never publicly served, downloadable by administrators only. They hold
  personal data: keep downloaded copies as carefully as the database. Available on every deployment.
- **Factory reset** — wipes every table and rebuilds the schema from the release's migrations; the operator who asked
  keeps their account (same id, so their session goes on) and the owner (`OROCHIA_OWNER_*`) is restored. A backup is
  taken first unless unticked — a failed backup stops the reset. The operator types `reset <database>` to arm it.
  Media at Bunny is not deleted.
- Both the reset and the release job's rebuild need **`OROCHIA_ALLOW_DATABASE_RESET=true`**, and are refused on the
  indexed production (`NODE_ENV=production` without `SEARCH_INDEXING=off`) whatever the flag says. Set it on the
  development app only (web service and migrate job).
- **Squashed migration history.** When a release ships a new baseline, a database that applied the old history cannot
  migrate forward. The release job detects it: with the flag it rebuilds the development database (empty, owner
  restored); without it the release fails with an explicit message and no data is touched.

## Self-hosted (Docker Compose + Caddy)

```bash
cp .env.example .env          # fill every production value
docker compose -f deploy/docker/docker-compose.prod.yml up -d --build
docker compose -f deploy/docker/docker-compose.prod.yml exec web node migrate.cjs
```

## Local development

```bash
docker compose -f deploy/docker/docker-compose.dev.yml up -d
cp .env.example .env          # OROCHIA_DEMO_MODE=true for the seeded demo accounts
npm install
npm run db:migrate && npm run db:seed
npm run dev                    # http://localhost:3000 — health: /api/health
```

## Quality gates

```bash
npm run lint        # ESLint (Next) + package typecheck
npm run typecheck   # web app types
npm test            # unit tests (auth, env, payments, media, passwords)
npm run build       # production build
npm run docs:generate -- --check
```

CI runs the same gates plus the bundled migrator and the seed against PostgreSQL 16.
