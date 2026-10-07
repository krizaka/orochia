---
title: Getting Started
description: Run Orochia locally in five commands, sign in with the seeded accounts, and know where to go next.
---

# Getting Started

Orochia is a TypeScript monorepo (npm workspaces): the Next.js web app in `apps/web` and three
packages — `db` (Drizzle schema, migrations, seed), `media` (Bunny Stream, Tus, signed URLs) and
`payments` (gateway adapters, ledger).

## 1. Prerequisites

| Tool | Version |
| :--- | :--- |
| Node.js | 20 or later |
| Docker + Docker Compose | for PostgreSQL 16 and Redis 7 |

## 2. Run it

```bash
git clone https://github.com/krizaka/orochia.git && cd orochia
docker compose -f deploy/docker/docker-compose.dev.yml up -d   # PostgreSQL 16 + Redis 7
cp .env.example .env                                             # set SESSION_SECRET (openssl rand -hex 32)
npm install
npm run db:migrate && npm run db:seed
npm run dev                                                      # http://localhost:3000
```

`OROCHIA_DEMO_MODE=true` (the `.env.example` default, ignored in production) lets the login page
offer the seeded accounts and settles unlocks immediately when no payment gateway is configured.

## 3. Seeded accounts

| Role | E-mail | Password |
| :--- | :--- | :--- |
| Administrator | `admin@orochia.org` | `admin1234` |
| Creator (verified) | `elena@orochia.org` | `elena1234` |
| Creator (verified) | `mia@orochia.org` | `mia1234` |
| Member | `alex@sanctuary.io` | `alex1234` |

These exist only in the development seed — production starts empty.

## 4. The admin console

The operator console is a separate repository, [`krizaka/orochia-admin`](https://github.com/krizaka/orochia-admin):

```bash
git clone https://github.com/krizaka/orochia-admin.git && cd orochia-admin
npm install
OROCHIA_API_URL=http://localhost:3000 npm run dev -- -p 3001     # sign in with the administrator account
```

## 5. Quality gates

Every change must pass, locally and in CI:

```bash
npm run lint && npm run typecheck && npm test && npm run build
npm run docs:generate -- --check                                  # the API reference matches the code
```

## Where next

- **Architecture** — how access, payments, the ledger and compliance fit together.
- **Media Pipeline** — direct-to-Bunny uploads and signed playback.
- **API Reference** — every endpoint and the rule that guards it, generated from the code.
- **Deployment & Operations** — configuration, gateway webhooks and DigitalOcean App Platform.
