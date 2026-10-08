---
title: Development Guide
description: Everyday commands, the database lifecycle (migrations, seed, reset, backups), tests and troubleshooting.
---

# Development Guide

The rules behind these commands live in [AGENTS.md](../AGENTS.md); this page is the how-to.

## First run

```bash
git clone https://github.com/krizaka/orochia.git && cd orochia
npm install
npm run setup        # .env + PostgreSQL 16 + migrations + seed
npm run dev          # http://localhost:3000
```

`npm run setup` is idempotent: run it again after pulling, or whenever the databases were stopped.

Clone the admin console and the design system next to this repository with `npm run workspace -- clone`, then
`npm run workspace -- status` shows the three repositories at a glance.

| App | Directory | Port | Start |
| :--- | :--- | :--- | :--- |
| Web app & API | `orochia/` | 3000 | `npm run dev` |
| Admin console | `../orochia-admin/` | 3001 | `OROCHIA_API_URL=http://localhost:3000 npm run dev -- -p 3001` |
| Design system showcase | `../orochia-design-system/` | 3002 | `npm run dev` |

## Accounts of the development seed

| Role | E-mail | Password | Notes |
| :--- | :--- | :--- | :--- |
| Administrator | `admin@orochia.org` | `admin1234` | signs in to the admin console |
| Creator | `elena@orochia.org` | `elena1234` | verified; public, paid and followers-only videos; payout in progress |
| Creator | `mia@orochia.org` | `mia1234` | verified; public, contacts-only and encoding videos |
| Creator | `nova@orochia.org` | `nova1234` | **not verified** — waits in the 2257 queue |
| Member | `alex@sanctuary.io` | `alex1234` | approved follower of Elena, contact of Mia, two unlocks |
| Member | `sam@sanctuary.io` | `sam1234` | pending follow of Elena, pending contact request to Mia |

## The database

PostgreSQL runs in the `orochia-postgres-dev` container
(`deploy/docker/docker-compose.dev.yml`, data in a named Docker volume).

| I want to… | Command |
| :--- | :--- |
| start / stop the databases | `npm run db:up` / `npm run db:down` |
| see applied and pending migrations, row counts | `npm run db:status` |
| browse and edit data | `npm run db:studio` (Drizzle Studio) or `npm run db:psql` |
| start over from a clean state | `npm run db:reset -- --yes` |
| keep a copy before an experiment | `npm run db:dump` → `backups/orochia-<date>.sql` |
| come back to that copy | `npm run db:restore -- backups/orochia-<date>.sql` |

`db:reset`, `db:restore` and `db:psql` work only on the local container: they refuse `NODE_ENV=production` and any
`DATABASE_URL` that does not point at this machine.

### Changing the schema

1. Edit the tables in `packages/db/src/schema/*.ts` (and their relations in `schema/index.ts`).
2. `npm run db:generate -- --name short_description` writes `packages/db/drizzle/NNNN_short_description.sql`.
3. **Read the SQL.** Renames are generated as drop + add — rewrite them as `ALTER … RENAME` by hand when data must survive.
4. `npm run db:migrate`, then `npm run db:check`.
5. `npm run docs:generate` — `docs/DATABASE.md` follows the schema.
6. Commit the schema, the migration and the docs together. Never edit a migration that was already applied anywhere.

### The seed

`packages/db/src/seed.ts` builds a small, coherent platform that exercises every feature. It is idempotent
(rows are keyed by e-mail, Bunny video id, gateway reference…), so `npm run db:seed` can run any time; it writes
ledger rows exactly as settlement does (10 % platform fee) and refuses to run with `NODE_ENV=production`.

## Tests

```bash
npm run check                    # lint + types + unit tests + generated docs up to date
npm run db:reset -- --yes        # the scenarios change data: start them from the seed
npm run test:e2e                 # needs the app running (npm run dev); OROCHIA_URL to target another one
```

## Environment

One `.env` at the repository root (created by `npm run setup` from `.env.example`). Everything starts without any
external account: the feed, profiles, followers, contacts, collections, comments, image stories and the seeded videos'
pages work on the local database, files are stored on disk (`STORAGE_DRIVER=local`), e-mail is logged instead of
sent, and with `OROCHIA_DEMO_MODE=true` unlocks settle immediately when no gateway is configured. In production every
secret is mandatory (see [Deployment](DEPLOYMENT.md)).

### Video features locally (Bunny Stream)

Uploading and playing videos, video stories and editor drafts need a Bunny Stream library — video never passes through
the app. A free trial library is enough:

1. Create a Stream library; in **API**, copy the library id, the API key and the **Read-Only** key; note the CDN hostname
   (`vz-….b-cdn.net`).
2. In **Security**, turn on CDN token authentication (copy its key) and add `localhost` to the allowed domains.
3. In **Encoding**, keep **Keep original files** on (drafts reopen from the original).
4. Fill `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_HOSTNAME`, `BUNNY_STREAM_TOKEN_AUTH_KEY` and
   `BUNNY_WEBHOOK_SECRET` (the Read-Only key), then restart `npm run dev`.

Bunny cannot call `localhost`, so locally a video stays "processing" until its webhook arrives: expose the app with a
tunnel (`cloudflared tunnel --url http://localhost:3000`, `ngrok http 3000`) and set the library's webhook to
`<tunnel>/api/webhooks/bunny`. The in-browser editor (ffmpeg.wasm) needs nothing: its engine is fetched once from a CDN.

## Troubleshooting

| Symptom | Fix |
| :--- | :--- |
| `port 5432 is already allocated` | Another PostgreSQL is running: stop it, or change the published port in the dev compose file and `DATABASE_URL` |
| `Too many attempts` at sign-in | Login attempts are rate-limited per account, in memory: restart `npm run dev` |
| Pages show empty states | The database is empty — `npm run db:seed` |
| `relation … does not exist` | Pending migrations — `npm run db:status`, then `npm run db:migrate` |
| Docs check fails in CI | `npm run docs:generate` and commit the regenerated files |
| A page reloads again and again | A stale build cache (often after `npm run build`): stop the server, `rm -rf apps/web/.next`, `npm run dev` |
| Thumbnails or draft clips answer 403 | Bunny's allowed domains do not include `localhost` (library → Security) |
| Uploaded videos stay "processing" | Bunny's webhook cannot reach `localhost` — use a tunnel (see *Video features locally*) |
