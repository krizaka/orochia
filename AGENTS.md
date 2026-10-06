# 🐍 OROCHIA — Governance Contract (agent-neutral)

> **Single source of truth** for architecture, data modeling, security invariants, and agent behavior across the **Orochia** monorepo ([`krizaka/orochia`](https://github.com/krizaka/orochia)).
> This file is **agent-neutral**: `CLAUDE.md` (and any other AI agent file) only **imports** it (`@AGENTS.md`). No rule lives anywhere except in this contract and codebase documentation.
> Every generation, review, or refactor **must** enforce these constraints without exception.

---

## 1. What This Repository Is

- **Orochia** is an open-source, high-performance video streaming and creator community platform specifically designed for independent creators and adult-friendly digital media.
- Architecture: Modern TypeScript **monorepo** with npm workspaces:
  - `apps/web`: Next.js 14 App Router (RSC, Server Actions, API Route Handlers), Tailwind CSS, HLS video player.
  - `packages/db`: Drizzle ORM schema, PostgreSQL pooling, migrations, and database seeds.
  - `packages/media`: Bunny.net Stream SDK client, Tus resumable upload signing, SHA-256 tokenized HLS stream security, webhook verifier.
  - `packages/payments`: Unified `PaymentGatewayAdapter` (CCBill, Segpay, Crypto/NowPayments, Stripe fallback), atomic tips ledger, and creator payouts.
  - `packages/config`: Shared TypeScript, ESLint, and Tailwind configurations.
  - `deploy/`: Multi-stage Docker, Docker Compose (dev/prod), Caddy reverse proxy, and DigitalOcean App Platform spec.

---

## 2. Absolute Invariants & Non-Negotiable Rules

### A. Zero-Trust Stream Authorization (No Direct Video Links)
- Raw video storage or unauthenticated CDN URLs are **never exposed** to clients.
- Video stream access (`/api/videos/[id]/stream`) **must verify authorization** server-side:
  1. `PUBLIC`: Accessible by any visitor.
  2. `CONTACTS_ONLY`: Must verify bidirectional contact record in `contacts` table.
  3. `TIPPED_UNLOCKED`: Must verify an existing `video_access_grants` record for the user/session, or that total tips exceed `minTipAmountCents`.
  4. `APPROVED_FOLLOWERS_ONLY`: Must verify accepted follow relation.
- Authorized requests generate a **short-lived, HMAC-SHA256 signed Bunny Stream token** (`generateBunnyStreamToken`) valid for 300 seconds.

### B. Direct-to-CDN Resumable Ingress (Tus Protocol)
- Heavy video binaries are **never proxied** through Next.js web application servers.
- Uploads follow the **presigned Tus session workflow**:
  1. Client requests upload session via `/api/videos/create-upload-session`.
  2. Server creates video entry in Bunny Stream via API and saves metadata in database.
  3. Server returns signed Tus endpoint and headers to client.
  4. Client uploads directly to Bunny Stream edge via Tus resumable protocol.
  5. Bunny webhooks (`/api/webhooks/bunny`) notify Orochia upon encode/transcode completion with signature verification.

### C. Double-Entry Tips & Ledger Integrity
- Tipping transactions are **immutable and double-entry** in `tips_ledger`.
- Creator balances and earnings must be calculated from ledger records (`calculateCreatorBalance`), never stored in an unverified mutable counter column.
- Unlocking paywalled content via tips must run atomically (`recordTipAndUnlock`), simultaneously registering the tip and creating a `video_access_grants` row.

### D. Adult-Compliant & Censorship-Resistant Payments
- Supported payment rails include high-risk / adult-friendly processors: **CCBill**, **Segpay**, and non-custodial / decentralized **Crypto (USDT-TRC20, BTC, ETH)** alongside standard fallback processors.
- All webhook handlers must implement constant-time signature verification (`verifyWebhookSignature`).

### D2. Payments are confirmed by the gateway, never by the client
- Unlock and tip requests record a `payment_intents` row and return the gateway's checkout URL. Only
  `/api/webhooks/payments/[gateway]` — after verifying the signature over the raw body — settles an
  intent (`settlePaymentIntent`), exactly once. Creator, sender and video come from the intent, never
  from the webhook payload.
- Gateway adapters have **no lenient mode**: a missing signature is a rejected webhook in every environment.
- A gateway is offered only when all its credentials are configured; there are no placeholder keys.

### D3. Configuration fails closed
- Secrets are read through `apps/web/lib/env.ts`: mandatory in production (503 + logged name when missing),
  development defaults otherwise. `OROCHIA_DEMO_MODE` is ignored in production.
- No screen renders showcase data: pages read the database through `apps/web/lib/queries.ts`, and an
  empty platform renders empty states.

### D4. Compliance records are data
- Content reports are persisted in `compliance_reports` before being acknowledged.
- Creators open upload sessions only once verified (`users.is_verified`, 2257 records).

### E. Deterministic Design & CSS Invariants
- `app/globals.css` must always contain the explicit `@config "../tailwind.config.js";` directive to guarantee monorepo Tailwind resolution across Next.js workers.
- `tailwind.config.js` content paths must use resolved paths (`path.join(__dirname, ...)`).
- Aesthetic Direction: **Obsidian Velvet Noir & Cyber-Sensual Luxury**:
  - Dark-mode first (`#09090b` background with ambient radial glow).
  - Glassmorphic panels (`.glass-panel`, `.glass-panel-elevated`).
  - Strict typography: **Outfit** (display/headings) and **Plus Jakarta Sans** (body).
  - Accessible WCAG AA contrast.

---

## 3. Directory Layout & Module Responsibilities

```
products/orochia/
├── apps/
│   └── web/                     # Next.js 14 App Router, Web UI & API Routes
│       ├── app/                 # App Router pages (/watch/[id], /creator/upload, etc.)
│       ├── components/          # Reusable UI (VideoPlayer, TipModal, VideoCard, Navbar)
│       ├── lib/                 # App-specific helpers
│       ├── tailwind.config.js   # Tailored design system config
│       └── postcss.config.js    # PostCSS pipeline
├── packages/
│   ├── db/                      # Drizzle ORM schema, client pool, seeds, migrations
│   │   ├── src/schema/          # Typed tables (users, videos, tips_ledger, etc.)
│   │   └── src/client.ts        # NodePgDatabase client & health check
│   ├── media/                   # Bunny.net Stream SDK, Tus signer, token generator
│   ├── payments/                # CCBill, Segpay, Crypto, Stripe adapters & ledger
│   └── config/                  # Shared tsconfig, tailwind base
├── deploy/                      # Dockerfile, docker-compose, Caddyfile, DigitalOcean spec
├── docs/                        # Architecture, Media Pipeline, Deployment specs
├── AGENTS.md                    # This contract (sole source of truth)
└── CLAUDE.md                    # Agent import proxy (@AGENTS.md)
```

---

## 4. Local Development & Operational Commands

- **Root Monorepo**: Operates via npm workspaces from `products/orochia`.
  - Install dependencies: `npm install`
  - Build entire monorepo: `npm run build`
  - Run web dev server: `npm run dev`
  - Lint all packages: `npm run lint`
- **Database Operations**:
  - Generate migrations: `npm run db:generate`
  - Apply migrations: `npm run db:migrate`
  - Seed demo data: `npm run db:seed`
- **Execution Rule**: Never propose raw `cd` commands in tool operations; use directory flags (`--prefix`, `git -C`, or working directory parameters).

---

## 5. Definition of Done (DoD)

1. `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` exit with code 0; `npm run docs:generate -- --check` is up to date.
2. TypeScript compiles with 0 errors (`skipLibCheck: true`).
3. Zero hardcoded credentials or API keys (all read from environment variables).
4. No direct video streaming bypasses (all media verified through access grants and signed tokens).
5. UI passes dark-mode visual and accessibility checks with responsive layouts.
