---
title: Development guide
nav: Development
description: Everyday commands, the database lifecycle, tests and troubleshooting.
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
| Operator console | `apps/web/app/console` (admin host, same app) | 3000 | see [ADMIN_CONSOLE.md](ADMIN_CONSOLE.md#run-it-locally) |
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
| come back to that copy | `npm run db:restore -- backups/orochia-<database>-<date>.sql` |

`db:reset`, `db:restore` and `db:psql` work only on the local container: they refuse `NODE_ENV=production` and any
`DATABASE_URL` that does not point at this machine. They act on the database **named in `DATABASE_URL`**, so a worktree
working on its own database (`create database orochia_<topic>` in the container, `DATABASE_URL=…/orochia_<topic>`) resets
only that one — never the shared `orochia_db`. `npm run test:e2e` reads `DATABASE_URL` from the environment (not `.env`):
export it too when the scenarios run against another database.

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

### The dev catalogue (a big dataset, made through Orazaka)

`dev.orochia.com` carries a realistic catalogue: ~30 fictional adult creators with avatars and banners, ~100 more videos, stories, collections,
fans with follows / views / likes / comments / paid unlocks / tips, challenges and auctions. It is **described** by `scripts/dev-dataset/`
(`creators/<key>.json` — one file per creator —, `fans.json`, `groups.json`, `challenges.json`, `auctions.json`; add a file to extend it) and
**made through Orazaka**, not by a side script: every picture is an `image-generation` Studio run (FLUX.2 [klein]), every clip a
`video-generation` run from an approved picture (Wan 2.2 TI2V 5B, 5 s). No media is ever committed — it lives in a scratch folder.

| Step | Command (from the repository root) |
|---|---|
| Open the accounts (sign-up is closed; the operator step of `db:test-accounts`, for the whole cast) | `PGHOST=… PGUSER=… PGPASSWORD=… PGDATABASE=… npm run dev:catalogue:accounts` |
| Make the pictures, then the clips (batch, N in flight, timings recorded) | `npm run dev:catalogue:make -- --media-dir <scratch> --phase images` / `--phase clips` |
| Look at them (contact sheets) and judge | `npm run dev:catalogue:review -- sheets images --media-dir <scratch>` then `approve` / `reject` |
| Send the approved items through the API as each creator | `npm run dev:catalogue:seed -- --media-dir <scratch> --phase profiles\|videos\|collections\|stories` |
| Audience: wallets, follows, views, likes, comments, tips, challenges, auctions | `npm run dev:catalogue:activity -- --phase …` |
| What Orazaka measured (queue, run times, failures, throughput) | `npm run dev:catalogue:measure -- --media-dir <scratch> --gpu-usd <spent>` |
| Remove it all | `npm run dev:catalogue:cleanup`, then `dev:catalogue:accounts -- --remove` |

Passwords are derived from `OROCHIA_DATASET_SECRET` (QA store) and the username — nothing per account is stored. The Orazaka QA account is
read from the QA store, never printed. A clip is made only from a picture a person approved; a bad asset is regenerated (`--redo <id> --variant <n>`),
never published. Stories live 24 hours: run the `stories` phase last, and again to refresh them.

### The demo

The official demo — Elena Marlow, a singer-songwriter who films her songs, and Alex Carter, a fan — lives in its own
database (`orochia_demo` on the dev container), so it never touches the shared development data:

```bash
npm run demo:seed                # rebuilds orochia_demo from scratch: people, videos, stories, payments, an auction,
                                 # a goal at 60 %, payouts (scripts/demo/cast.json); refuses production and remote hosts
npm run build && npm run demo:start   # the production build on the demo database, http://localhost:3100
npm run record:tour              # the krizaka.com clips (needs ffmpeg and Playwright's chromium)
```

Sign in as `elena@example.com` or `alex@example.com` (password `orochia-demo`). Each person has a face of their own
— a fictional adult generated by Orazaka (`packages/db/src/people.ts`, credits in `apps/web/public/CREDITS.md`), never
shared with another product; the development seed uses the same portraits. Videos and stories play the licensed showcase clips in the recordings, e-mails are on `example.com`.

## Tests

```bash
npm run check                    # lint + types + unit tests + generated docs up to date
npm run db:reset -- --yes        # the scenarios change data: start them from the seed
npm run test:e2e                 # needs the app running (npm run dev); APP_URL to target another one
```

## Environment

One `.env` at the repository root (created by `npm run setup` from `.env.example`). Everything starts without any
external account: the feed, profiles, followers, contacts, collections, comments, image stories and the seeded videos'
pages work on the local database, files are stored on disk (`MEDIA_STORAGE_PROVIDER=local`), e-mail is logged instead of
sent, and with `APP_DEMO_MODE=true` unlocks settle immediately when no gateway is configured. In production every
secret is mandatory (see [Deployment](DEPLOYMENT.md)).

### Video features locally (Bunny Stream)

Uploading and playing videos, video stories and editor drafts need a Bunny Stream library — video never passes through
the app. A free trial library is enough:

1. Create a Stream library; in **API**, copy the library id, the API key and the **Read-Only** key; note the CDN hostname
   (`vz-….b-cdn.net`).
2. In **Security**, turn on CDN token authentication (copy its key) and add `localhost` to the allowed domains.
3. In **Encoding**, keep **Keep original files** on (drafts reopen from the original).
4. Fill `MEDIA_STREAM_API_KEY`, `MEDIA_STREAM_LIBRARY_ID`, `MEDIA_STREAM_HOSTNAME`, `MEDIA_STREAM_TOKEN_AUTH_KEY` and
   `MEDIA_STREAM_WEBHOOK_SECRET` (the Read-Only key), then restart `npm run dev`.

Bunny cannot call `localhost`, and a library has **one** webhook URL — a library shared by several environments (local
and dev) notifies only one of them. Without the webhook, **video stories still go live**: the stories rail asks the
Stream API about any video story unsettled for 20 s (`reconcileStoryVideos`, `lib/stories.ts`) and settles it as the
webhook would, and the author sees their story as *Processing* meanwhile. Videos and drafts still wait for the webhook:
to exercise it, expose the app with a tunnel (`cloudflared tunnel --url http://localhost:3000`, `ngrok http 3000`) and
set the library's webhook to `<tunnel>/api/webhooks/bunny`. The in-browser editor (ffmpeg.wasm) needs nothing: its engine is fetched once from a CDN.

### E-mail templates

Every e-mail is a template in `apps/web/mail-templates/<id>/<locale>/` (`subject.txt`, `body.html`, `body.txt`), inside
the shared `_layout/` (rules: AGENTS.md §3.G). Locally they are read from those files (`MAIL_TEMPLATES_SOURCE=local`)
and the messages go to the log; `MAIL_DELIVERY=on` with a Resend or Mailgun key really sends them.

```bash
npm run mail:templates:preview   # apps/web/.mail-preview/index.html — every template, en and fr
npm run mail:templates:push      # dry run against Bunny Storage; -- --apply publishes (production credentials)
```

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
| Uploaded videos stay "processing" | Bunny's webhook cannot reach `localhost` — use a tunnel (see *Video features locally*). Video stories catch up on their own (the rail asks Bunny) |

## The core journey on dev — `npm run journey:dev`

`scripts/journey-dev.mjs` replays the product's core journey on the real dev backend (dev.orochia.com), through the public
API, as two demo personas (a creator and a fan, never an operator): **upload** a 6-second synthetic test clip (made by
ffmpeg, titled as such) through Orochia's own Tus session to Bunny Stream, **encode** (it waits for READY), **watch** (a
signed HLS master playlist that answers), **tip** in credits (the fan's wallet moves by the amount), **earnings** (the
creator's ledger moves by the share — 90 % at the default fee — written once). It prints the edge's request id (`cf-ray`) of
every call, writes them with `--report <file.json>`, films the fan's watch page with `--record <dir>`, and removes the clip
at the end unless `--keep`. Credentials are read from the secret store (`secret.sh @orochia OROCHIA_CREATOR_*`,
`OROCHIA_FAN2_*`) and never printed. Its rules are tested in `scripts/journey.test.mjs`. This is the evidence of the Dev
preview criterion `journey.core`.
