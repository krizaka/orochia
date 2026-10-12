# ADR 0001 — Realtime transport for chat and presence

**Status**: accepted (2026-10-11) · **Scope**: Orochia web + mobile · **Code**: [`@krizaka/realtime`](https://github.com/krizaka/krizaka-ui/tree/main/packages/realtime) (was `packages/realtime`), `apps/web/lib/realtime.ts`

## Context

Orochia gets Messenger-style messaging: instant delivery, "typing…", sent / delivered / read receipts, an unread badge,
resume after a cut without loss or duplicate, and presence ("online", "away", "seen 5 min ago"). Constraints:

- one App Platform instance today, several tomorrow; **no sticky sessions** on App Platform; minimal monthly cost;
- the mobile app (Expo) already holds the account's stream with `react-native-sse` and a bearer token, and falls back to
  push (Expo → FCM / APNs) in the background — a phone app in the background holds no socket, whatever the transport;
- the existing decision (company `decisions.md`): SSE over PostgreSQL LISTEN/NOTIFY, no WebSocket, no broker, and
  `realtime.ts` as the one file to change when more is needed.

## Options

| | SSE + POST (current) | WebSocket (ws / uWebSockets / Socket.IO) | Managed (Ably, Pusher, Supabase Realtime) | Broker (Redis / Valkey pub/sub, NATS) |
| :--- | :--- | :--- | :--- | :--- |
| Direction | server → client stream; actions are the existing HTTP API (auth, zod, rate limits) | full duplex | full duplex | (between instances only — still needs SSE or WS to the client) |
| App Platform | plain HTTP, heartbeats every 15 s keep the edge's 100 s idle limit away; no affinity needed | supported; Socket.IO across instances needs an adapter (no affinity) | nothing to host | Managed Caching (Valkey) from ~$15/month; NATS = one more service |
| Next.js 16 | a route handler returning a stream | a custom server (no route handler upgrades a socket): loses `output: "standalone"` simplicity | SDK + webhook to authorise channels | a client library |
| Reconnect / resume | built into `EventSource` (`Last-Event-ID`); the server replays from the database | hand-written (Socket.IO: in-memory only) | provided, within their retention | n/a |
| Auth | the same cookie / bearer as the API | the same, at upgrade | their token, minted by us | n/a |
| Cost | 0 | 0 (but ops) | per connection / message: grows with the audience; data leaves our infrastructure (an adult platform's DMs) | 0 → ~$15/month |
| Typing, receipts | small POSTs (≤ 1 every 3 s while typing) | frames | frames | n/a |

The only traffic that would favour WebSocket is client → server at high frequency (cursors, games, voice). "Typing…" is
at most one request every 3 seconds per person writing; read receipts one per batch read. Measured below, a POST costs
nothing worth a second protocol.

## Decision

1. **Keep SSE for server → client and HTTP POST for client → server**, one stream per tab / app
   (`/api/conversations/stream`), resumable: message events carry `id: m<seq>` and the server replays what a
   reconnecting client missed from `direct_messages` (the database is the truth, never the bus).
2. **Put the transport behind one interface**, `RealtimeBus` (`publish` / `subscribe` by channel + `presence`), in a
   package that knows nothing of Orochia (`@orochia/realtime`). Adapters: `memory` (tests), **`postgres`**
   (LISTEN/NOTIFY, default — no extra service) and **`redis`** (Redis / Valkey pub/sub, subscribed per channel, presence
   in Redis with Lua). Chosen by `REALTIME_BUS=postgres|redis` (`REDIS_URL`); a `redis` bus without a URL is a
   configuration error, never a silent fallback. Business code (`lib/messaging.ts`, `lib/presence.ts`,
   `lib/chat-stream.ts`) only sees the interface.
3. **Presence by heartbeat + TTL, never a database write per beat**: each open stream beats every 15 s (TTL 45 s); a
   closed stream lingers 10 s (a reconnection does not flicker "offline"); the database gets `users.last_seen_at` once
   per visit. With `postgres`, each instance keeps its connections in memory and replicates its view over the same
   NOTIFY channel (changes + a snapshot every 30 s); with `redis`, presence lives in Redis.
4. **Switch to `redis` when**: more than ~3 instances (with `postgres` every instance receives every event), more than
   ~10 k concurrent streams, or LISTEN/NOTIFY shows up in the database's load. Nothing else changes.
5. A managed service is refused for now: cost that grows with the audience and private messages of an adult platform
   leaving our infrastructure. WebSocket is refused: a custom server for no traffic that needs it.

## Measurements (local, production build, MacBook, 2026-10-11)

`node scripts/realtime-load.mjs` — N streams of one account held open, messages sent and timed until every stream has
them (latency from before the POST to the frame's arrival, including the send's own database work).

| Bus | Instances | Streams | Delivered to every stream | p50 | p95 | max | Server memory |
| :--- | :---: | ---: | :---: | ---: | ---: | ---: | :--- |
| postgres | 1 | 500 | yes | 27 ms | 61 ms | 67 ms | +48 MB (≈ 98 KB per stream) |
| redis | 1 | 500 | yes | 25 ms | 32 ms | 34 ms | +52 MB (≈ 106 KB per stream) |
| postgres | 1 | 2 000 | yes | 47 ms | 65 ms | 71 ms | +174 MB (≈ 89 KB per stream) |
| redis | 1 | 2 000 | yes | 51 ms | 67 ms | 74 ms | +203 MB (≈ 104 KB per stream) |
| postgres | 2 (send on one, streams on the other) | 500 | yes | 28 ms | 64 ms | 66 ms | — |
| redis | 2 | 500 | yes | 29 ms | 75 ms | 77 ms | — |

The measurements agree with the decision: well under the one-second target at 2 000 streams on one small instance; the
two adapters are equivalent at this size, so the default stays the one with no extra service. The two-instance run
found a real bug, fixed here: an instance whose own LISTEN connection was not up yet delivered its events only
locally (NOTIFY needs no LISTEN — it now always notifies).

## Consequences

- One stream per tab (`lib/realtime-client.ts` shares it between the bell, the badge and Messages); the mobile app
  keeps `react-native-sse` and adds `?after=<seq>` on reconnect.
- The bus is best-effort; durability is the database's: messages are replayed from `seq`, receipts and unread counts
  reloaded on reconnect.
- `@orochia/realtime` was the candidate `@krizaka/realtime` brick ([krizaka/krizaka-ui#75](https://github.com/krizaka/krizaka-ui/issues/75):
  a TypeScript package beside `@krizaka/i18n`; `krizaka-platform-kit` is the JVM side). **2026-10-11**: a second
  product (Yazakia) needs it — published as `@krizaka/realtime` (and `packages/push` as `@krizaka/push`); Orochia
  consumes the npm versions, same API, its channel and prefix passed explicitly. The presence dot is local until `Avatar` has a status ([krizaka/krizaka-ui#74](https://github.com/krizaka/krizaka-ui/issues/74)).
