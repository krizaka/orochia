# Orochia — Deployment & Operations

## Environment variables

> Generated from `apps/web/lib/env.ts` (`ENV_VARS`) by `scripts/generate-docs.mjs` — do not hand-edit this section.

Every variable is named `<CONTEXT>_<THING>` after the part of the platform it configures — never after the product or
a vendor: a vendor is a value (`MEDIA_STORAGE_PROVIDER=bunny`, `MAIL_PROVIDER=resend`). `NEXT_PUBLIC_` marks the few the
browser needs. **Production** ✓ = a deployment refuses to start without it (`assertEnv`, `apps/web/lib/env.ts`); **Secret**
= a `SECRET` on App Platform. Build-time variables are marked *(build)*.

### Application — `APP_`

Public URL, environment, build.

| Variable | Production | Secret | Default | What it does |
| :--- | :---: | :---: | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` *(build)* | ✓ |  | `http://localhost:3000` | Public origin: links in e-mails, payment return URLs, IPN callbacks, OAuth redirects. |
| `NEXT_PUBLIC_APP_ENV` *(build)* | — |  | `local` | The build badge next to the brand (`v<version> · <env> · <commit>`), never shown with `production`. |
| `APP_COMMIT_SHA` *(build)* | — |  |  | The commit the image is built from (App Platform: `${_self.COMMIT_HASH}`, its Docker build has no `.git`); else `git rev-parse`. |
| `APP_SEARCH_INDEXING` *(build)* | — |  | `on` | `off` on dev and preview deployments: every page noindex, robots.txt disallows all. Only production is indexed. |
| `APP_PUBLIC_ACTIONS` | — |  | `on` | `off` on dev: a signed-out visitor's story views and shares are answered but not counted; sign-in stays as it is. |
| `APP_DEMO_MODE` | — |  |  | Local only: the login page switches between seeded demo accounts; payments settle without a gateway. Ignored in production. |

### Database — `DATABASE_`

PostgreSQL.

| Variable | Production | Secret | Default | What it does |
| :--- | :---: | :---: | :--- | :--- |
| `DATABASE_URL` | ✓ |  |  | PostgreSQL 16 connection string. |
| `DATABASE_CA_CERT` | recommended |  |  | CA of a managed PostgreSQL (PEM; App Platform: `${<db>.CA_CERT}`): TLS is verified against it. |
| `DATABASE_MAX_CONNECTIONS` | — |  | `5` | Connections one instance's pool may hold — see *Database connections*. |
| `DATABASE_ALLOW_RESET` | — |  |  | Factory reset from the admin console, and rebuild by the release job when migrations were squashed. Never honoured on the indexed production. |

### Authentication — `AUTH_`

Sessions, owner account, sign-in providers.

| Variable | Production | Secret | Default | What it does |
| :--- | :---: | :---: | :--- | :--- |
| `AUTH_SESSION_SECRET` | ✓ | ✓ |  | Signs sessions: ≥ 32 random characters (`openssl rand -hex 32`). |
| `AUTH_OWNER_EMAIL` | recommended |  |  | The platform owner (ADMIN, verified), created or reactivated by the release job — see *Owner account*. |
| `AUTH_OWNER_USERNAME` | recommended |  |  | The owner's username. |
| `AUTH_OWNER_NAME` | recommended |  |  | The owner's display name. |
| `AUTH_OWNER_PASSWORD` | — | ✓ |  | Only to create the owner (10+ characters); an existing account keeps its password. |
| `AUTH_OWNER_ROLE` | — |  | `ADMIN` | The owner's role. |
| `AUTH_TEST_FAN_EMAIL` | — |  |  | QA fan account, injected by `npm run db:test-accounts` (packages/db) — e-mail. |
| `AUTH_TEST_FAN_USERNAME` | — |  |  | QA fan account — username. |
| `AUTH_TEST_FAN_PASSWORD` | — | ✓ |  | QA fan account — password (12+ characters). Never printed. |
| `AUTH_TEST_CREATOR_EMAIL` | — |  |  | QA creator account, injected by `npm run db:test-accounts` — e-mail. |
| `AUTH_TEST_CREATOR_USERNAME` | — |  |  | QA creator account — username. |
| `AUTH_TEST_CREATOR_PASSWORD` | — | ✓ |  | QA creator account — password (12+ characters). Never printed. |
| `AUTH_TEST_DATE_OF_BIRTH` | — |  |  | QA accounts' date of birth (YYYY-MM-DD, 18+); default 1990-01-01. |
| `AUTH_SIGNUP_ENABLED` | — |  | `false` | Opens sign-up (the form, `/api/auth/register`, new Google / Facebook accounts). Off by default: a development deployment is closed to newcomers (403 `signup_disabled`), existing accounts still sign in. Read at request time; `/api/auth/providers` and `/api/auth/me` expose it as `signupEnabled`. |
| `AUTH_GOOGLE_CLIENT_ID` | — |  |  | Sign in with Google — offered only with its secret too. See *Sign-in providers*. |
| `AUTH_GOOGLE_CLIENT_SECRET` | — | ✓ |  | Sign in with Google: the OAuth client secret. |
| `AUTH_FACEBOOK_APP_ID` | — |  |  | Sign in with Facebook — offered only with its secret too. |
| `AUTH_FACEBOOK_APP_SECRET` | — | ✓ |  | Sign in with Facebook: the app secret. |

### Media — `MEDIA_`

Video streaming, storage, CDN, editor drafts.

| Variable | Production | Secret | Default | What it does |
| :--- | :---: | :---: | :--- | :--- |
| `MEDIA_STREAM_API_KEY` | ✓ | ✓ |  | Video library (Bunny Stream) API key. |
| `MEDIA_STREAM_LIBRARY_ID` | ✓ |  |  | Video library id. |
| `MEDIA_STREAM_HOSTNAME` | ✓ |  |  | The library's delivery hostname (`vz-….b-cdn.net`). |
| `MEDIA_STREAM_TOKEN_AUTH_KEY` | ✓ | ✓ |  | Signs playback URLs (edge token authentication, 300 s). |
| `MEDIA_STREAM_WEBHOOK_SECRET` | ✓ | ✓ |  | The library's Read-Only API key: every encode webhook is signed with it (v1, HMAC-SHA256). |
| `MEDIA_STREAM_TOKEN_BIND_IP` | — |  | `off` | Binds signed playback URLs to the viewer's IP. Off by default. |
| `MEDIA_STREAM_COLLECTION_ID` | — |  |  | Collection every new video is filed in. |
| `MEDIA_STREAM_STORIES_COLLECTION_ID` | — |  |  | Collection of story videos (else the first). |
| `MEDIA_STREAM_DRAFTS_COLLECTION_ID` | — |  |  | Collection of editor drafts' originals (else the first). |
| `MEDIA_STORAGE_PROVIDER` | ✓ |  | `local` | Where pictures, drafts' music and 2257 documents are kept: `local` disk (development) or `bunny` (production: container disks are ephemeral). |
| `MEDIA_STORAGE_API_KEY` | ✓ | ✓ |  | Storage zone password (`bunny`). |
| `MEDIA_STORAGE_ZONE` | ✓ |  |  | Storage zone name (`bunny`). |
| `MEDIA_STORAGE_ENDPOINT` | — |  | `storage.bunnycdn.com` | Storage API host of the zone's region. |
| `MEDIA_STORAGE_ZONE_ID` | — |  |  | The zone's numeric id for reconciliation (else searched by name). |
| `MEDIA_CDN_HOSTNAME` | ✓ |  |  | Pull zone hostname that serves the storage zone. |
| `MEDIA_ACCOUNT_API_KEY` | — | ✓ |  | Account API key: reconciliation also records the library's and the zone's billed totals. |
| `MEDIA_DRAFT_RETENTION_DAYS` | — |  | `30` | Days an editor draft is kept, then removed with its files. |
| `MEDIA_DRAFTS_MAX_PER_USER` | — |  | `20` | Editor drafts an account may keep. |

### E-mail — `MAIL_`

Provider, sender, templates.

| Variable | Production | Secret | Default | What it does |
| :--- | :---: | :---: | :--- | :--- |
| `MAIL_PROVIDER` | recommended |  |  | Transactional e-mail service. Unset: nothing is sent (records are written first) — see *E-mail*. |
| `MAIL_API_KEY` | recommended | ✓ |  | The provider's API key. |
| `MAIL_DOMAIN` | — |  | `mg.orochia.com` | Sending domain (`mailgun`). |
| `MAIL_API_URL` | — |  | `https://api.mailgun.net` | Mailgun API base (EU region: `https://api.eu.mailgun.net`). |
| `MAIL_FROM` | — |  | `Orochia <no-reply@mg.orochia.com>` | Sender address. |
| `MAIL_DELIVERY` | — |  |  | Outside production nothing leaves (messages go to the log) unless `on`. |
| `MAIL_COMPLIANCE_ALERT_TO` | recommended |  |  | Receives every content report (`[URGENT]` for underage / non-consensual); comma-separated. |
| `MAIL_TEMPLATES_SOURCE` | — |  | `local (bunny in production)` | Templates from this repository or from `mail-templates/` in the storage zone (bundled ones as fallback). |
| `MAIL_TEMPLATES_CACHE_TTL` | — |  | `300` | Seconds a template read from storage is kept in memory. |
| `MAIL_TEMPLATES_DIR` | — |  | `apps/web/mail-templates` | Another folder of templates. |

### Mobile push — `PUSH_`



| Variable | Production | Secret | Default | What it does |
| :--- | :---: | :---: | :--- | :--- |
| `PUSH_DELIVERY` | — |  |  | Pushes (Expo Push Service) leave only in production or with `on`; `off` stops them in production too. |
| `PUSH_ACCESS_TOKEN` | — | ✓ |  | Expo access token — only when enhanced push security is on in the Expo project. |

### Payments — `PAYMENTS_`

Gateways, platform fee, payouts, credits.

| Variable | Production | Secret | Default | What it does |
| :--- | :---: | :---: | :--- | :--- |
| `PAYMENTS_PAYOUT_ENCRYPTION_KEY` | ✓ | ✓ |  | Encrypts payout account details at rest (AES-256-GCM, ≥ 32 characters). Keep it: changing it makes saved payout accounts unreadable. |
| `PAYMENTS_PLATFORM_FEE_PERCENTAGE` | — |  | `10` | The platform's share of every sale. |
| `PAYMENTS_CREDITS_MODE` | — |  |  | `test` adds a free test top-up to the wallet. Ignored on the indexed public deployment. |
| `PAYMENTS_CCBILL_CLIENT_ACCOUNT` | — |  |  | CCBill (FlexForms dynamic pricing) — a gateway is offered only when all its variables are set. |
| `PAYMENTS_CCBILL_CLIENT_SUBACCOUNT` | — |  |  | CCBill sub-account. |
| `PAYMENTS_CCBILL_FORM_NAME` | — |  |  | CCBill FlexForm. |
| `PAYMENTS_CCBILL_SALT` | — | ✓ |  | CCBill dynamic-pricing salt. |
| `PAYMENTS_CCBILL_WEBHOOK_SECRET` | — | ✓ |  | Signs CCBill postbacks (HMAC-SHA256, `X-CCBill-Signature`). |
| `PAYMENTS_SEGPAY_MERCHANT_ID` | — |  |  | Segpay merchant. |
| `PAYMENTS_SEGPAY_PACKAGE_ID` | — |  |  | Segpay package. |
| `PAYMENTS_SEGPAY_SECRET_KEY` | — | ✓ |  | Signs Segpay postbacks (HMAC-SHA256). |
| `PAYMENTS_NOWPAYMENTS_API_KEY` | — | ✓ |  | NowPayments (crypto) API key. |
| `PAYMENTS_NOWPAYMENTS_IPN_SECRET` | — | ✓ |  | Signs NowPayments IPN callbacks (HMAC-SHA512). |
| `PAYMENTS_STRIPE_SECRET_KEY` | — | ✓ |  | Stripe secret key. |
| `PAYMENTS_STRIPE_WEBHOOK_SECRET` | — | ✓ |  | Signs Stripe webhooks (`Stripe-Signature` v1). |

### Realtime — `REALTIME_`

Chat, presence, notifications, auctions.

| Variable | Production | Secret | Default | What it does |
| :--- | :---: | :---: | :--- | :--- |
| `REALTIME_BUS` | — |  | `postgres` | The bus behind streams and presence: PostgreSQL LISTEN/NOTIFY (one to ~3 instances), Redis/Valkey beyond, memory for tests — see *Realtime*. |
| `REALTIME_REDIS_URL` | — | ✓ |  | Redis / Valkey URL — required with `REALTIME_BUS=redis`. |
| `REALTIME_STREAM_MAX_SECONDS` | — |  | `300` | A stream ends after this long and the client resumes at once. |
| `REALTIME_PREFIX` | — |  | `orochia:rt:` | Channel prefix on the bus. |

### Abuse defences — `ABUSE_`

Rate limits, bot challenge, sign-up rules, storage quotas.

| Variable | Production | Secret | Default | What it does |
| :--- | :---: | :---: | :--- | :--- |
| `ABUSE_RATE_LIMIT_STORE` | recommended |  | `memory` | Rate-limit counters: `memory` (one instance) or `postgres` (shared — required with 2+ instances). |
| `ABUSE_CLIENT_IP_HEADER` | recommended |  |  | The header the edge puts the visitor's address in (App Platform: `do-connecting-ip`). |
| `ABUSE_TRUSTED_PROXY_HOPS` | — |  | `1` | Else: the entry this far from the right of `X-Forwarded-For`. |
| `ABUSE_BOT_CHALLENGE` | recommended |  | `auto` | Cloudflare Turnstile on sign-up and password reset: `auto` (on when both keys are set), `required`, `off`. |
| `ABUSE_BOT_CHALLENGE_SITE_KEY` | recommended |  |  | Turnstile site key (an Invisible widget). |
| `ABUSE_BOT_CHALLENGE_SECRET_KEY` | recommended | ✓ |  | Turnstile secret key. |
| `ABUSE_SIGNUP_MIN_FILL_SECONDS` | — |  | `3` | Seconds a sign-up form must have been open (bots are faster). |
| `ABUSE_BLOCKED_EMAIL_DOMAINS` | — |  |  | Extra refused e-mail domains (comma-separated). |
| `ABUSE_ALLOWED_EMAIL_DOMAINS` | — |  |  | Domains let through the disposable-address list. |
| `ABUSE_QUOTAS` | — |  | `on` | Storage quotas (not the rate limits). `off` is refused in production without `ABUSE_QUOTAS_OFF_CONFIRMED=true` — see *Storage quotas*. |
| `ABUSE_QUOTAS_OFF_CONFIRMED` | — |  |  | Records the decision to run production without quotas. |
| `ABUSE_QUOTA_PLATFORM_GB` | recommended |  | `100` | The whole platform's storage: past it, new uploads are refused. |
| `ABUSE_QUOTA_PLATFORM_MINUTES` | — |  | `unlimited` | The whole platform's video minutes. |
| `ABUSE_QUOTA_ALERT_THRESHOLDS` | — |  | `80,95` | Percentages of the platform cap that alert the operators once each. |
| `ABUSE_QUOTA_CREATOR_DEFAULT_GB` | recommended |  | `10` | A creator's storage when no plan is set. |
| `ABUSE_QUOTA_CREATOR_DEFAULT_MINUTES` | — |  | `600` | A creator's video minutes when no plan is set. |
| `ABUSE_QUOTA_PLANS` | — |  | `pro=100GB/3000min,unlimited=unlimited` | Named plans an operator gives an account (`name=<size>/<minutes>min`, comma-separated). |
| `ABUSE_QUOTA_ADMIN_PLAN` | — |  | `unlimited` | The plan of ADMIN accounts (the owner). |
| `ABUSE_QUOTA_VIDEO_MAX_MB` | — |  | `4096` | Per video file, under the hard limit (4 GB). |
| `ABUSE_QUOTA_VIDEO_MAX_MINUTES` | — |  | `180` | Per video, under the hard limit (180 min). |
| `ABUSE_QUOTA_STORY_MAX_MB` | — |  | `250` | Per story video (250 MB hard limit). |
| `ABUSE_QUOTA_DRAFT_MAX_MB` | — |  | `400` | Per draft original (400 MB hard limit). |
| `ABUSE_QUOTA_UPLOADS_PER_DAY` | — |  | `50` | Upload sessions (videos, video stories, drafts) per account and 24 h. |
| `ABUSE_QUOTA_CONCURRENT_UPLOADS` | — |  | `3` | Upload sessions still waiting for their bytes, per account. |
| `ABUSE_QUOTA_IMAGE_UPLOADS_PER_DAY` | — |  | `100` | Pictures (avatars, covers, thumbnails, story images) per account and day. |
| `ABUSE_QUOTA_RECONCILE_INTERVAL_MINUTES` | — |  | `360` | Reconciliation with the media provider every N minutes (0: never). |

### Observability — `OBSERVABILITY_`

Metrics.

| Variable | Production | Secret | Default | What it does |
| :--- | :---: | :---: | :--- | :--- |
| `OBSERVABILITY_METRICS_TOKEN` | ✓ | ✓ |  | Bearer token for `/api/metrics`. |

### AI — `AI_`

The Orazaka engine the Explorer calls (embeddings), never a model provider.

| Variable | Production | Secret | Default | What it does |
| :--- | :---: | :---: | :--- | :--- |
| `AI_ENGINE_URL` | — |  |  | Base URL of the Orazaka edge (its `/edge` path): the Explorer's semantic search and recommendations. Unset: the Explorer runs on full-text search alone. |
| `AI_ENGINE_API_KEY` | — | ✓ |  | The Orazaka API key of the Explorer, scoped `ai:embed` (embeddings only). Without it the Explorer does not call Orazaka. |

### Operator console — `OPERATOR_`

The admin API.

| Variable | Production | Secret | Default | What it does |
| :--- | :---: | :---: | :--- | :--- |
| `OPERATOR_API_TOKEN` | recommended | ✓ |  | Service token of the operator console (32+ characters, the same value on both deployments): opens ADMIN routes only, acting as the owner. Unset: refused. |

A missing required value makes the requests that need it answer **503** and logs the variable name, and a deployment
whose environment is incomplete or malformed does not start (App Platform keeps the previous release) — the platform
never runs on a placeholder secret. A gateway is offered only when **all** its variables are set.

## Gateway webhooks

| Gateway | Endpoint | Signature header |
| :--- | :--- | :--- |
| CCBill | `/api/webhooks/payments/ccbill` | `X-CCBill-Signature` (HMAC-SHA256 of the raw body, `PAYMENTS_CCBILL_WEBHOOK_SECRET`) |
| Segpay | `/api/webhooks/payments/segpay` | `X-Segpay-Signature` (HMAC-SHA256, `PAYMENTS_SEGPAY_SECRET_KEY`) |
| NowPayments | `/api/webhooks/payments/crypto` | `x-nowpayments-sig` (HMAC-SHA512 of the key-sorted body, `PAYMENTS_NOWPAYMENTS_IPN_SECRET`) |
| Stripe | `/api/webhooks/payments/stripe` | `Stripe-Signature` (v1, 300 s tolerance, `PAYMENTS_STRIPE_WEBHOOK_SECRET`) — events `checkout.session.*` |
| Bunny Stream | `/api/webhooks/bunny` | `X-BunnyStream-Signature` v1 (HMAC-SHA256 of the raw body, keyed with the library's Read-Only API key = `MEDIA_STREAM_WEBHOOK_SECRET`) |

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

The spec has no Redis: rate limits are shared through PostgreSQL (`ABUSE_RATE_LIMIT_STORE=postgres`) and the realtime bus
is PostgreSQL LISTEN/NOTIFY (`REALTIME_BUS=postgres`). Both hold for a few instances; see *Realtime* for when to add
a Valkey cache.

### Realtime (chat, presence, notifications, auctions)

- **Streams are plain HTTP** (Server-Sent Events, `/api/conversations/stream`, `/api/auctions/:id/stream`,
  `/api/challenges/:id/stream`): App Platform passes them unbuffered. Its edge closes a request **idle for 100 s** and
  has **no session affinity**: the streams send a heartbeat every 15 s, end themselves after
  `REALTIME_STREAM_MAX_SECONDS` (default 300 — the browser reconnects at once with `Last-Event-ID` and the missed
  messages are replayed from the database), and any instance serves any stream.
- `DATABASE_URL` must be a **direct** connection (LISTEN needs a session; not a transaction pooler). Each instance
  holds one extra connection for LISTEN.

### Database connections

Every process opens **one** pool (`packages/db/src/client.ts`, kept on `globalThis`: Next.js loads the module in several
module graphs — pages, route handlers, instrumentation — and a module-level pool was created once per graph, three
pools of 20 on a production build; that exhausted the dev database on 2026-10-12, PostgreSQL 53300 on every page).
The admin console's platform status, backups and factory reset use the same pool; the realtime bus (a process-wide
singleton too) holds exactly one LISTEN connection. Idle connections are closed after 10 s.

Budget — keep it at **70 % of the usable slots** at most (headroom for a console, a stuck deploy, DigitalOcean's own
probes):

```
(instances + 1 rolling-deploy overlap, ≈ 40 s) × (DATABASE_MAX_CONNECTIONS + 1 LISTEN)
  + jobs (migrate: 1) + admin (psql / consoles: 1)   ≤ 70 % × usable slots
```

| Database | `max_connections` (superuser-reserved) | Usable | 70 % | With `DATABASE_MAX_CONNECTIONS=5` |
| :--- | :--- | :--- | :--- | :--- |
| App Platform dev database (orochia-dev, measured) | 25 (3) | 22 | 15 | 1 instance: (1 + 1) × 6 + 2 = **14** ✓ |
| Managed PostgreSQL `db-s-1vcpu-1gb` | 25 (3) | 22 | 15 | 1 instance ✓ — a 2nd needs a bigger plan or a pooler |

Measured on dev after the fix (2026-10-12): 5 `orochia-web` connections under load, one process, one pool. The admin
console (orochia-admin) has its own database and is not in this budget.

When the database refuses connections (53300, restarting, unreachable), the server logs **one line** every 30 s
(`[db] database unavailable: 53300 … (N more since the last report)`) rather than a stack per query, and the pages
that can do without the data degrade instead of failing whole. A connection pooler (DigitalOcean connection pools /
PgBouncer) is being studied separately; it would carry the queries, never the LISTEN connection or the migrations.
- **Scaling out**: up to ~3 instances, keep `REALTIME_BUS=postgres` (every instance receives every event; presence is
  replicated between instances over the same channel). Beyond, or past ~10 k concurrent streams, create a
  DigitalOcean **Managed Caching (Valkey)** cluster in the same region, add it to the app's trusted sources, and set
  `REALTIME_BUS=redis` + `REALTIME_REDIS_URL=rediss://default:<password>@<host>:25061` (SECRET). Nothing else changes; the switch
  takes a redeploy and drops nothing durable (messages live in PostgreSQL).
- Measured locally: 2 000 streams on one instance, p95 under 70 ms, ≈ 90–105 KB of memory per stream
  ([ADR 0001](adr/0001-realtime-transport.md)). Repeat with `node scripts/realtime-load.mjs` before a launch.

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
  and secret into `AUTH_GOOGLE_CLIENT_ID` / `AUTH_GOOGLE_CLIENT_SECRET`.
- **Facebook** — developers.facebook.com → *Create app* (Consumer) → add *Facebook Login* → *Valid OAuth Redirect
  URIs* as above; permissions `email`, `public_profile`. App ID and secret go into `AUTH_FACEBOOK_APP_ID` / `AUTH_FACEBOOK_APP_SECRET`.
  Note: Meta's platform policies restrict adult services; check that your use is allowed before going live.

A provider sign-in lands in the account linked to it, or in the account whose address the provider verified (linked
then). A new person completes their account — username, 18+ certification, terms — before it is created.

### Owner account

The default user — the platform owner — comes from the environment of the release job:

| Variable | |
| :--- | :--- |
| `AUTH_OWNER_EMAIL` | turns the feature on |
| `AUTH_OWNER_USERNAME`, `AUTH_OWNER_NAME` | 3–30 `a-z0-9_`; display name |
| `AUTH_OWNER_PASSWORD` (SECRET) | needed to create the account (10+ characters); an existing account keeps its password |

On every release `migrate.cjs` applies the migrations, then creates or reactivates that account (ADMIN, age- and
2257-verified, not suspended). Nothing is deleted. Locally the seed does the same from `.env`, and
`npm run db:owner [-- --email … --username … --name "…"] [--reset-password]` applies it to any `DATABASE_URL`.

### Bunny Stream security

| Setting (library → Security) | Value |
| :--- | :--- |
| CDN token authentication | **on** — `MEDIA_STREAM_TOKEN_AUTH_KEY` is its key; every playback URL is signed for 300 s |
| Block direct url file access | on, with **Allowed domains** `orochia.com`, `*.orochia.com` (and `localhost` while developing) |
| Embed view token authentication | off — the app plays HLS itself, not Bunny's embedded player |
| Webhook | `https://<domain>/api/webhooks/bunny`. Bunny signs it (v1, HMAC-SHA256) with the library's **Read-Only API key**: that key is `MEDIA_STREAM_WEBHOOK_SECRET`. **Required**: without it uploads never leave "processing" (video stories alone catch up by asking the Stream API). One URL per library: give each environment its own library |
| Keep original files (library → Encoding) | **on** — an editor draft is reopened from its original (`/<guid>/original`, signed for its owner) |

Thumbnails and preview animations are on the same CDN, so they are signed too — one file per token
(`?token=…&expires=…`, 6-hour windows), which never opens the video's renditions.

### Storage zone (avatars, thumbnails, story images, drafts' music, 2257 documents)

`MEDIA_STORAGE_ZONE`, `MEDIA_STORAGE_API_KEY` (the zone's password), `MEDIA_STORAGE_ENDPOINT` (region host, default
`storage.bunnycdn.com` = Frankfurt) and `MEDIA_CDN_HOSTNAME` (the pull zone connected to the storage zone). File
names are random UUIDs. 2257 documents are stored under `private/` with no public URL and are read by operators only,
through `GET /api/admin/documents?ref=…`; the music of editor drafts (`private/audio/`) is served to its owner only.
Add an edge rule on the storage pull zone that blocks `/private/*`.

The token is carried in the path (`/bcdn_token=…&token_path=/<guid>/…`) so renditions and segments, requested by
relative URL, are authorised too. New uploads are filed in the collection `MEDIA_STREAM_COLLECTION_ID`; who may
watch is decided by the app, never by Bunny collections.

### Upload limits and editor drafts

Limits live in one place, `packages/media/src/limits.ts`, read by the browser (checked before anything is sent) and
by the server: a video is at most **4 GB and 3 hours**, a story clip **250 MB and 60 seconds** (vertical 9:16, always
edited first), an editor draft's original **400 MB** (what the in-browser editor opens), its music **25 MB**. The
upload session refuses a larger declared size; Bunny's webhook reports the real length, and a video or story longer
than allowed is marked FAILED and deleted at Bunny — a client that lies about the size gains nothing.

A draft keeps the **original** clip at Bunny (drafts collection), the edit settings and the form in `video_drafts`,
and the music under `private/audio/` in storage. Saving it again only updates the settings. It is removed with its
files when published, deleted, or after `MEDIA_DRAFT_RETENTION_DAYS`.

### Storage quotas

So that Bunny's bill never surprises anyone, every upload must fit two budgets **before it is signed**: the platform's
cap and the creator's plan (rules, codes and the Bunny study: [MEDIA_PIPELINE.md §6](MEDIA_PIPELINE.md#6-storage-quotas)).
The application counts the bytes and minutes it keeps (declared at the session, Bunny's real size at the end of
encoding) and reconciles them with Bunny every 6 hours, on `npm run quota:reconcile`, or from the admin API.

| Variable | dev (recommended) | production (recommended) | Meaning |
| :--- | :--- | :--- | :--- |
| `ABUSE_QUOTAS` | `on` | `on` | `off` only as a written decision, with `ABUSE_QUOTAS_OFF_CONFIRMED=true` in production |
| `ABUSE_QUOTA_PLATFORM_GB` | `50` | `500` (raise with the budget: ~$5–15 / month per 500 GB of Stream storage, depending on replication) | Past it, new uploads are refused (`PLATFORM_STORAGE_FULL`) |
| `ABUSE_QUOTA_PLATFORM_MINUTES` | `unlimited` | `unlimited` | Optional cap on video time |
| `ABUSE_QUOTA_ALERT_THRESHOLDS` | `80,95` | `80,95` | Operators alerted once per threshold (bell, push, e-mail) |
| `ABUSE_QUOTA_CREATOR_DEFAULT_GB` / `_MINUTES` | `5` / `600` | `20` / `600` | A creator without a plan |
| `ABUSE_QUOTA_PLANS` | `pro=100GB/3000min,unlimited=unlimited` | same, plus any commercial plan | Plans an operator gives (`PATCH /api/admin/storage/<userId>`) |
| `ABUSE_QUOTA_ADMIN_PLAN` | `unlimited` | `unlimited` | The owner's plan |
| `ABUSE_QUOTA_UPLOADS_PER_DAY` / `ABUSE_QUOTA_CONCURRENT_UPLOADS` | `50` / `3` | `50` / `3` | Sessions per 24 h / in progress |
| `ABUSE_QUOTA_IMAGE_UPLOADS_PER_DAY` | `100` | `100` | Pictures per account and day |
| `ABUSE_QUOTA_RECONCILE_INTERVAL_MINUTES` | `360` | `360` | `0` turns the automatic reconciliation off |

Give each environment **its own Stream library**: a library shared by two environments makes each see the other's
videos as orphans (counted in its usage). A video **held** for want of space (status HELD) is never deleted: it goes
online when its creator frees space or gets a larger plan.

### Abuse defences

- **Rate limits** (`lib/rate-limit.ts`): per account **and** per IP on every action that can be abused (sign-up, sign-in,
  password reset, uploads, tips, unlocks, bids, messages, reports, search, explore…), answered `429` with `Retry-After`.
  `ABUSE_RATE_LIMIT_STORE=memory` (default) counts per instance — fine for **one** instance only; set
  `ABUSE_RATE_LIMIT_STORE=postgres` (table `rate_limit_buckets`, swept every 10 minutes) **before running two instances**.
  A Redis / Valkey store implements the same interface when the load calls for it (issue #40).
- **The visitor's address** (`lib/client-ip.ts`): the left end of `X-Forwarded-For` is written by the client, so it is
  never trusted. On App Platform set `ABUSE_CLIENT_IP_HEADER=do-connecting-ip`; behind one other proxy (Caddy) the default
  `ABUSE_TRUSTED_PROXY_HOPS=1` reads the address that proxy appended.
- **Bot challenge — Cloudflare Turnstile.** Cloudflare dashboard → Turnstile → *Add widget*: domains `orochia.com`
  (and the dev host), **Widget mode: Invisible**. Copy the site key to `ABUSE_BOT_CHALLENGE_SITE_KEY` and the secret to
  `ABUSE_BOT_CHALLENGE_SECRET_KEY` (SECRET), then set `ABUSE_BOT_CHALLENGE=required` in production (a missing key then refuses sign-up
  with 503 instead of running unprotected). Sign-up and password reset **fail closed** when Cloudflare is unreachable
  (503 `CHALLENGE_UNAVAILABLE`); content reports are never challenged (a report of abuse is never lost); reading is never
  challenged.
- **Sign-up** also needs a form token at least `ABUSE_SIGNUP_MIN_FILL_SECONDS` (3) old, bound to a device cookie, refuses a
  filled honeypot, disposable e-mail domains (`lib/abuse/disposable-email-domains.ts`, `ABUSE_BLOCKED_EMAIL_DOMAINS`,
  `ABUSE_ALLOWED_EMAIL_DOMAINS`) and scripted clients, and is limited to 5 per IP an hour and 3 per device a day.
- **Sign-in**: 5 free failures per identifier an hour, then a lock-out of 30 s doubling to 15 min (`LOGIN_LOCKED`), and
  50 attempts per IP per 15 min.
- **Playback**: signed URLs live 300 s; `MEDIA_STREAM_TOKEN_BIND_IP=on` also binds them to the viewer's IP — leave it off until
  checked on real traffic (IPv4/IPv6 and mobile networks can change the address mid-play).
- **Headers**: a Content-Security-Policy (no plugins, no framing, `base-uri`/`form-action` locked, scripts from this
  origin, Turnstile and the ffmpeg core CDN only), HSTS, `nosniff`, `X-Frame-Options: DENY`, COOP `same-origin`,
  referrer and permissions policies (`apps/web/next.config.mjs`).

### E-mail (Resend, mg.orochia.com)

The sending domain `mg.orochia.com` is declared in Resend; its records live at Porkbun under `mg`: DKIM
`TXT resend._domainkey.mg`, and `CNAME send.mg` / `CNAME rsend.mg` (as Resend lists them). Once Resend shows the domain
verified, set `MAIL_PROVIDER=resend`, `MAIL_API_KEY` (SECRET) and `MAIL_COMPLIANCE_ALERT_TO` in the app. Mailgun is the
other value: `MAIL_PROVIDER=mailgun` with `MAIL_API_KEY` and `MAIL_DOMAIN` (+ `MAIL_API_URL` for the EU region).

Every message is a template (`apps/web/mail-templates/`, AGENTS.md §3.G). In production they are read from
`mail-templates/` in the Bunny Storage zone and fall back to the copy bundled in the image. After a release that changes
a template — or to correct wording without a release — publish the repository's tree with the production
`MEDIA_STORAGE_API_KEY`, `MEDIA_STORAGE_ZONE` and `MEDIA_STORAGE_ENDPOINT` in the environment:

```bash
npm run mail:templates:push              # dry run: new / changed / unchanged per file
npm run mail:templates:push -- --apply   # writes them; instances pick them up within MAIL_TEMPLATES_CACHE_TTL
```

The storage pull zone serves the zone publicly: templates hold no secret, but keep them that way.

## Backups and factory reset

The admin console (**Platform & Database**) shows the deployment, the database (size, rows per table) and where its
migration history stands against the release.

- **Backups** — *Back up now* writes every table as gzipped JSON to private storage (`private/backups/` on Bunny Edge
  Storage; `.private-uploads/backups/` locally), never publicly served, downloadable by administrators only. They hold
  personal data: keep downloaded copies as carefully as the database. Available on every deployment.
- **Factory reset** — wipes every table and rebuilds the schema from the release's migrations; the operator who asked
  keeps their account (same id, so their session goes on) and the owner (`AUTH_OWNER_*`) is restored. A backup is
  taken first unless unticked — a failed backup stops the reset. The operator types `reset <database>` to arm it.
  Media at Bunny is not deleted.
- Both the reset and the release job's rebuild need **`DATABASE_ALLOW_RESET=true`**, and are refused on the
  indexed production (`NODE_ENV=production` without `APP_SEARCH_INDEXING=off`) whatever the flag says. Set it on the
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
cp .env.example .env          # APP_DEMO_MODE=true for the seeded demo accounts
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
