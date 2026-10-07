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
npm install
npm run setup     # .env (generated SESSION_SECRET) · PostgreSQL 16 + Redis 7 · migrations · seed
npm run dev       # http://localhost:3000
```

`npm run setup` is idempotent. `OROCHIA_DEMO_MODE=true` (the `.env.example` default, ignored in production) lets
the login page offer the seeded accounts and settles unlocks immediately when no payment gateway is configured.

## 3. Seeded accounts

| Role | E-mail | Password |
| :--- | :--- | :--- |
| Administrator | `admin@orochia.org` | `admin1234` |
| Creator (verified) | `elena@orochia.org` | `elena1234` |
| Creator (verified) | `mia@orochia.org` | `mia1234` |
| Creator (2257 pending) | `nova@orochia.org` | `nova1234` |
| Member | `alex@sanctuary.io` | `alex1234` |
| Member | `sam@sanctuary.io` | `sam1234` |

These exist only in the development seed — production starts empty. The Development guide describes what each
account demonstrates and the database commands (`db:status`, `db:reset`, `db:studio`, backups).

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
npm run check          # lint · type-check · unit tests · generated docs up to date
npm run build
npm run test:e2e       # feature scenarios, on a freshly reset database with the app running
```

## Where next

- **Development guide** — everyday commands, schema changes, seed, reset and backups.
- **Database reference** — every table, index and foreign key, generated from the schema.
- **Architecture** — how access, payments, the ledger and compliance fit together.
- **Media Pipeline** — direct-to-Bunny uploads and signed playback.
- **API Reference** — every endpoint and the rule that guards it, generated from the code.
- **Deployment & Operations** — configuration, gateway webhooks and DigitalOcean App Platform.
