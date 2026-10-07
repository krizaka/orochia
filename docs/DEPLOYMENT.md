# Orochia — Deployment & Operations

## Requirements

| Variable | Required in production | Notes |
| :--- | :---: | :--- |
| `NODE_ENV=production` | ✓ | Enables strict configuration: no defaults, no demo mode. |
| `NEXT_PUBLIC_APP_URL` | ✓ | Public origin, used for payment return URLs and IPN callbacks. |
| `SESSION_SECRET` | ✓ | ≥ 32 random characters (`openssl rand -hex 32`). |
| `DATABASE_URL` | ✓ | PostgreSQL 16. |
| `REDIS_URL` | recommended | Rate limiting and feed cache; unset in production → no client, limits fail open. App Platform needs a managed Valkey/Redis cluster for it (dev databases are PostgreSQL only). |
| `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_HOSTNAME`, `BUNNY_STREAM_TOKEN_AUTH_KEY`, `BUNNY_WEBHOOK_SECRET` | ✓ | Video library, edge token auth and encode webhooks. |
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

```bash
doctl apps create --spec deploy/digitalocean/app-spec.yaml
```

The spec builds `deploy/docker/Dockerfile` and runs a **PRE_DEPLOY job** (`node migrate.cjs`) that applies
`packages/db/drizzle` before every release. Set the secrets listed above in the app's settings. The
`Deploy to DigitalOcean` workflow redeploys on `main` once `DIGITALOCEAN_ACCESS_TOKEN` and
`DIGITALOCEAN_APP_ID` repository secrets exist (it is skipped, not failed, until then).

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
