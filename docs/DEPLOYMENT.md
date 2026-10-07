# Orochia — Deployment & Operations

## Requirements

| Variable | Required in production | Notes |
| :--- | :---: | :--- |
| `NODE_ENV=production` | ✓ | Enables strict configuration: no defaults, no demo mode. |
| `NEXT_PUBLIC_APP_URL` | ✓ | Public origin, used for payment return URLs and IPN callbacks. |
| `SESSION_SECRET` | ✓ | ≥ 32 random characters (`openssl rand -hex 32`). |
| `DATABASE_URL` | ✓ | PostgreSQL 16. |
| `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_HOSTNAME`, `BUNNY_STREAM_TOKEN_AUTH_KEY`, `BUNNY_WEBHOOK_SECRET` | ✓ | Video library, edge token auth and encode webhooks. |
| `BUNNY_STREAM_COLLECTION_ID` | — | Collection new uploads are filed in (UUID). |
| `STORAGE_DRIVER=bunny`, `BUNNY_STORAGE_API_KEY`, `BUNNY_STORAGE_ZONE`, `BUNNY_PULL_ZONE_HOSTNAME` | ✓ | Avatars, thumbnails, 2257 documents (container disks are ephemeral). |
| `METRICS_AUTH_TOKEN` | ✓ | Bearer token for `/api/metrics`. |
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
| Bunny Stream | `/api/webhooks/bunny` | `BunnyCDN-Signature` (HMAC-SHA256, `BUNNY_WEBHOOK_SECRET`) |

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
