---
title: Realtime
nav: Realtime
description: The bus, the streams, reconnection and presence.
---

# Realtime — how Orochia stays live

A message lands, a bid moves the price, a pledge fills the pot, someone comes online: the screens that care hear of it
in well under a second, on the web and in the app, without polling. This page describes **what runs** — the bus, the
streams, the events, how a cut connection catches up — and how to test it. Push to closed phones is in
[NOTIFICATIONS.md](NOTIFICATIONS.md); why this transport and not WebSocket or a managed service is in
[ADR 0001](adr/0001-realtime-transport.md).

---

## 1. The picture

```
 an action (HTTP POST: send, bid, pledge, follow…)
   │
   ▼
 the database ── commit ──▶ publish(topic, event)           apps/web/lib/realtime.ts (the only door)
                                │
                                ▼
                     RealtimeBus (@krizaka/realtime)
          postgres: NOTIFY orochia_events ─┐      redis: PUBLISH orochia:rt:<topic>
                                           ▼
             every instance's LISTEN connection / subscription
                                           │
                                           ▼
             the Server-Sent Events streams that instance holds
          ┌───────────────────────────────┼────────────────────────────────┐
          ▼                               ▼                                ▼
 /api/conversations/stream     /api/auctions/:id/stream         /api/challenges/:id/stream
 (one per tab or app, signed   (public: bids, state)            (public: pledges, state)
  in: user:<id> + presence)
          │                               │                                │
          ▼                               ▼                                ▼
 web: one shared EventSource   web: the auction panel           web: the challenge page
 app: react-native-sse         app: useLiveTopic                app: useLiveTopic
      (Authorization: Bearer)
```

- **The database is the truth, the bus only tells sooner.** An event is published after the commit; what must not be
  lost (a message) is replayed from the database on reconnection, what is a count (unread, a pot) is reloaded.
- **Server → client only.** The client acts through the ordinary API (auth, validation, rate limits); the stream only
  lets it hear what follows. Plain HTTP: through every proxy, the same cookie or bearer token, no sticky sessions.
- **Any instance serves any stream**: the fan-out between instances is the bus's job.

## 2. The bus

`publish(topic, event)` and `subscribe(topic, callback)` (`apps/web/lib/realtime.ts`) are all the business code sees.
Behind them, the `RealtimeBus` of [`@krizaka/realtime`](https://www.npmjs.com/package/@krizaka/realtime), chosen by
configuration:

| `REALTIME_BUS` | Crossing instances | Presence | When |
| :--- | :--- | :--- | :--- |
| `postgres` (default) | `NOTIFY orochia_events` → each instance's dedicated `LISTEN` connection (`packages/db/src/listen.ts`), filtered by topic | each instance's memory, replicated over the same channel (changes + a snapshot every 30 s) | one to ~3 instances — no extra service |
| `redis` + `REALTIME_REDIS_URL` | Redis / Valkey pub/sub, one subscription per topic an instance needs (prefix `orochia:rt:`) | in Redis (one Lua script per beat, keys that expire) | more instances, ~10 k+ streams, or NOTIFY weighing on the database |
| `memory` | none (one process) | memory | tests |

- `publish` never throws (realtime is best-effort); payloads are small facts (≤ 8 KB — the NOTIFY limit), never
  documents.
- A `LISTEN` connection that drops comes back with a growing, capped delay; while it is down the instance still
  NOTIFYs for the others and hands its own events to its own subscribers.
- An instance whose `LISTEN` is not up yet still reaches the others (NOTIFY needs no LISTEN — a bug the two-instance
  load test found, fixed in the package).

### Topics

| Topic | Who listens | Events |
| :--- | :--- | :--- |
| `user:<id>` | that account's streams (every tab, every phone in front) | messages, receipts, typing, unread, notifications, `circle_changed`, `conn_state` |
| `presence:<id>` | the streams of the people allowed to see that account (§5) | `presence` |
| `auction:<id>` | anyone with the auction open | `bid`, `state` |
| `challenge:<id>` | anyone with the challenge open | `pledge`, `state` |

## 3. The streams and their events

Every stream: `retry: 2000`, a `connected` named event first, a heartbeat comment every **15 s** (App Platform cuts
requests idle for 100 s), and an end after `REALTIME_STREAM_MAX_SECONDS` (300) — the client reconnects at once and
catches up (§4). Data lines are JSON with a `type`.

### The account's stream — `GET /api/conversations/stream`

Signed in (cookie on the web, `Authorization: Bearer` from the app). One per tab or app, shared in the browser by the
bell, the Messages badge and the inbox (`apps/web/lib/realtime-client.ts`), held by `LiveProvider` in the app.

| Event | To | Carries |
| :--- | :--- | :--- |
| `connected` (named) | the stream | `connectionId`, `resumed`, `serverNow` |
| `new_message` · `message_sent` | the recipient · the sender's other apps | the message; SSE `id: m<seq>` |
| `receipt` | the sender | `conversationId`, `state` (`delivered` · `read`), `upTo` (seq), `at` |
| `read` · `unread` | the reader's apps | a conversation read elsewhere · the account's unread total (the badge) |
| `typing` | the other participant | `conversationId`, `userId`, `typing` — never stored |
| `presence` · `presence_snapshot` | the circle | `userId`, `state` (`online` · `away` · `offline`), `lastSeenAt` · the whole circle at once |
| `circle_changed` · `resync` | the stream | rebuild presence (a block, a setting) — the first at once, a burst once more after 1 s · reload (too much missed) |
| `notification` | the account | `id`, `event`, `text`, `path`, `createdAt` — the bell and a toast ([NOTIFICATIONS.md](NOTIFICATIONS.md)) |

### An auction — `GET /api/auctions/:id/stream` (public)

| Event | Carries |
| :--- | :--- |
| `bid` | `bid` (`id`, `amountCents`, `alias`, `createdAt`), `highestBidCents`, `bidsCount`, `leaderAlias`, `endsAt` (moved by a bid in the last 2 minutes), `extended`, `minimumNextBidCents`, `suggestedBidsCents` |
| `state` | `status` (closed, sold, cancelled…) — viewers reload |

Bidders are aliases (*Bidder 2*), never names: the feed is public.

### A challenge — `GET /api/challenges/:id/stream` (public)

| Event | Carries |
| :--- | :--- |
| `pledge` | `pledge` (`id`, `alias`, `amountCents`, `createdAt`), `pledgedCents` (the pot), `backersCount`, `progress` |
| `state` | `status` (accepted, funded, delivered, released…) — viewers reload |

## 4. Order, duplicates, reconnection

- **Order.** A conversation's `seq` (bigserial) is assigned under its row lock, so its messages commit in `seq` order;
  a topic's events reach a subscriber in the order they were published (one NOTIFY channel, one connection).
- **Idempotent sends.** The app sends a `clientId` (UUID) with each message; a retry after a lost answer gets the
  stored message back (`200`, `duplicate: true`), never a second one.
- **Resume.** Message events carry `id: m<seq>`. A reconnection sends `Last-Event-ID: m<seq>` (the browser does it by
  itself) or `?after=<seq>` (the app keeps its own cursor). The stream subscribes **first**, holds what arrives, replays
  from `direct_messages` what was missed (with a 10 s overlap for transactions numbered earlier but committed later),
  then releases what it held — **each message once**: one both replayed and published meanwhile is sent once.
  More than 500 missed → `resync` (reload). A malformed cursor is ignored.
- **Counts are reloaded, not replayed.** After a reconnection the clients reload unread counts, receipts and
  presence; an auction or challenge screen reloads itself on `connected` (its feed has no history).
- **Delivered** is marked once per message, whichever of the recipient's streams got it first.

## 5. Presence

`apps/web/lib/presence.ts` (who, SQL), `apps/web/lib/presence-rules.ts` (the rule, pure), the heartbeat in the package.

- Each open account stream is a **heartbeat**: `online` at open, refreshed every **15 s**, expired after a **45 s TTL**
  (a crashed tab). `POST /api/presence { connectionId, state }` says `away` (page hidden, 3 min idle) or `online` again.
- A person is as present as their most present connection (a phone in front keeps them online while a tab sleeps).
- A closed stream **lingers 10 s** before `offline`, so a reconnection does not flicker; `users.last_seen_at` is written
  once, when the last app closes — never per beat.
- **Who sees whom**: two active accounts, no block either way, both showing their presence (*Settings → Privacy*;
  hiding yours hides everyone's from you), and an accepted contact, an **exchange** (both wrote in a shared
  conversation) or an approved follow of a creator (the fan sees the creator, not the reverse). No exception for
  administrators. `GET /api/presence?ids=` answers only the visible; `GET /api/presence/online` is "Online now".

## 6. Clients

| | Web | App (krizaka/orochia-mobile) |
| :--- | :--- | :--- |
| Account stream | one `EventSource` per tab, shared (`lib/realtime-client.ts`); `away` when hidden or idle | `LiveProvider` (`src/lib/live.tsx`, `react-native-sse`, bearer), in front only; reopened with `?after=` when the app comes back |
| Messages | `components/messages` (`useChat`) | `src/app/messages`, merging in `src/lib/chat.ts` (same rules as the web) |
| Auction / challenge | the auction panel, the challenge page | `useLiveTopic` (`src/lib/live-topic.ts`): the event moves the screen at once (`src/lib/live-updates.ts` — numbers never go back down), then a reload brings what is the viewer's |
| In the background | — | push takes over ([NOTIFICATIONS.md](NOTIFICATIONS.md) §3) |

## 7. Measured

`node scripts/realtime-load.mjs` (production build, one MacBook, 2026-10-11 — [ADR 0001](adr/0001-realtime-transport.md)):
N streams of one account held open, messages timed from before the `POST` to the frame's arrival on every stream.

| Bus | Instances | Streams | p50 | p95 | max | Memory |
| :--- | :---: | ---: | ---: | ---: | ---: | :--- |
| postgres | 1 | 500 | 27 ms | 61 ms | 67 ms | ≈ 98 KB per stream |
| postgres | 1 | 2 000 | 47 ms | 65 ms | 71 ms | ≈ 89 KB per stream |
| postgres | 2 | 500 | 28 ms | 64 ms | 66 ms | — |
| redis | 1 | 2 000 | 51 ms | 67 ms | 74 ms | ≈ 104 KB per stream |

The e2e scenarios hold the same line in CI: a message reaches the recipient's stream in under a second.

## 8. How to test it

| Level | What | Where |
| :--- | :--- | :--- |
| Package | bus contract, presence TTL / grace / replication, SSE framing, heartbeats, lifetime, LISTEN reconnection | `@krizaka/realtime` (krizaka/krizaka-ui `packages/realtime/test`) |
| Unit | the account stream run over a stand-in bus: `connected`, ids, replay order, held events, each message once, `resync`, delivered once, hang-up | `apps/web/lib/chat-stream.test.ts` |
| Unit | who sees whom | `apps/web/lib/presence-rules.test.ts` |
| Integration | the wiring against real PostgreSQL and Valkey, two instances each (`REALTIME_IT=1`) | `apps/web/lib/realtime.integration.test.ts` (CI e2e job) |
| e2e | two live streams, a message in < 1 s, typing, delivered/read, a cut stream resumed (`Last-Event-ID`) without loss or duplicate, idempotent retry, presence by the rules, a block closing it all, a notification live on its owner's stream only, an auction's bid live, a challenge's pledges live and in order | `e2e/scenarios.mjs` (`npm run test:e2e`) |
| App | the topic stream (open, events, background, unmount), live updates, the account stream's merging | krizaka/orochia-mobile `src/lib/__tests__` |
| Load | N streams, latency and memory, one or two instances | `node scripts/realtime-load.mjs --url … --streams 500 [--send-url …]` |

By hand, with a local Orochia (`npm run dev`, the seed's accounts):

```bash
# an auction's live feed (public): leave it open, then bid from the web or the app
curl -N http://localhost:3000/api/auctions/<id>/stream
# the account's stream, resumed after message 42 (signed in: the session cookie or a native bearer token)
curl -N -H "Authorization: Bearer <token>" -H "Last-Event-ID: m42" http://localhost:3000/api/conversations/stream
```

## 9. Deploying

App Platform has no session affinity and cuts requests idle for 100 s: the heartbeat (15 s) and the stream's own end
(300 s, then an immediate reconnection that resumes) make that invisible, and no affinity is needed. Each instance holds
one `LISTEN` connection on top of its pool — counted in the connection budget ([DEPLOYMENT.md](DEPLOYMENT.md)). Before
a second instance: `ABUSE_RATE_LIMIT_STORE=postgres`; past ~3 instances, `REALTIME_BUS=redis` (DigitalOcean Managed Caching,
Valkey). Nothing else changes.

## 10. Where the code is

```
@krizaka/realtime (npm)                    the bus interface, memory / PostgreSQL / Redis adapters, presence, SSE framing
packages/db/src/listen.ts                  the LISTEN / NOTIFY primitives handed to the bus
apps/web/lib/realtime.ts                   the door: picks the bus, publish / subscribe / sseResponse
apps/web/lib/chat-stream.ts                the account's stream: replay, delivery, presence heartbeat, circle filter
apps/web/lib/presence.ts · presence-rules.ts   circle (kept 30 s per account, forgotten at once on a change — `circle-cache.ts`), presence views, last seen · who sees whom
apps/web/lib/messaging.ts                  messages, receipts, unread, typing, reports, blocks
apps/web/lib/auctions.ts · challenges.ts   announceBid / announcePledge / state changes
apps/web/lib/realtime-client.ts            the browser's single shared stream, activity (away / online)
apps/web/app/api/conversations/stream      the account's stream route
apps/web/app/api/{auctions,challenges}/[id]/stream   the public feeds
scripts/realtime-load.mjs                  the load test
```
