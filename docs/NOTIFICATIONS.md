# 🔔 Notifications & Realtime

Something happens — a follower, a tip, an unlock, a bid, a pledge, a message — and the person it concerns hears of it
**wherever they are**: on an open page (in the second), on their phone (even with the app closed), by e-mail (at the
pace they chose). One event, one row, three channels.

---

## 1. The channels

| Where the person is | Channel | How |
| :--- | :--- | :--- |
| A page of orochia.com is open | **Server-Sent Events** | `/api/conversations/stream` (topic `user:<id>`): the bell's count moves, a **toast** slides in for a few seconds, the list updates |
| The Orochia app is open | **Server-Sent Events** | the same stream, with the native session as `Authorization: Bearer` |
| The app is closed or in the background | **Push** | Expo Push Service → **FCM** (Android) / **APNs** (iOS), to every phone registered by the account |
| Away | **E-mail** | `INSTANT`, `HOURLY` or `NONE` (`profiles.email_frequency`) |

Every event goes through `notify()` (`apps/web/lib/notifications.ts`): it writes the notification (the source of
truth), publishes it live, pushes it to the phones, then e-mails it. Each event can be turned off per channel in
*Settings → Notifications* (the "in the app" switch covers the bell, the toasts and the phone).

## 2. Why SSE and not WebSocket

The traffic is **one-way, server → client**: the client acts through ordinary HTTP requests (follow, tip, bid,
send a message), and only has to *hear* what follows. That is what Server-Sent Events are for:

- **Plain HTTP**: through every proxy and CDN (checked on DigitalOcean App Platform — the stream is not buffered,
  heartbeats every 15 s), the same cookie or bearer token as the rest of the API, no protocol upgrade, no extra port.
- **Reconnection is built in** (`EventSource` retries by itself and sends `Last-Event-ID`): the messages missed are
  replayed from the database, the rest (receipts, unread counts) reloaded — nothing missed while offline stays missing.
- **No sticky sessions**: any instance serves any stream, because the fan-out happens in PostgreSQL (below).

WebSocket would pay for a full-duplex channel nobody uses, and ask for sticky routing or a pub/sub tier to fan out
between instances. It becomes the right tool only for high-frequency client → server traffic (video calls, cursors,
games) — none of which Orochia has. Chat included: "typing…" is one small POST every 3 s at most, and measured
latency stays under 80 ms at 2 000 streams on one instance ([ADR 0001](adr/0001-realtime-transport.md)).

## 3. One bus, chosen by configuration

`apps/web/lib/realtime.ts` is the only door: `publish(topic, event)` → the **`RealtimeBus`** of
[`@krizaka/realtime`](https://www.npmjs.com/package/@krizaka/realtime) → every instance's subscribers → the SSE streams they hold. Topics:
`user:<id>` (notifications, messages, receipts, typing, the unread count), `presence:<id>` (one account's presence,
followed only by the streams of the people allowed to see it), `auction:<id>`, `challenge:<id>`. Payloads are small
facts (≤ 8 KB), never documents. Why this transport and not WebSocket, a managed service or a broker:
[ADR 0001](adr/0001-realtime-transport.md).

| `REALTIME_BUS` | How events cross instances | Presence | When |
| :--- | :--- | :--- | :--- |
| `postgres` (default) | `NOTIFY orochia_events` → each instance's `LISTEN` connection (`packages/db/src/listen.ts`); every instance receives every event | each instance's memory, replicated over the same channel (changes + a snapshot every 30 s) | one to ~3 instances — no extra service |
| `redis` + `REDIS_URL` | Redis / Valkey pub/sub, one subscription per channel an instance needs | in Redis (one Lua script per beat, keys that expire) | more instances, ~10 k+ streams, or LISTEN/NOTIFY weighing on the database |
| `memory` | none (one process) | memory | tests |

The code that publishes never knows which: switching is a variable and a restart. The bus is the Krizaka brick
[`@krizaka/realtime`](https://github.com/krizaka/krizaka-ui/tree/main/packages/realtime) (extracted from Orochia when a
second product needed it, [krizaka/krizaka-ui#75](https://github.com/krizaka/krizaka-ui/issues/75)); Orochia hands it
its LISTEN/NOTIFY primitives (`packages/db/src/listen.ts`), its channel `orochia_events` and its Redis prefix
`orochia:rt:`.

## 4. Mobile push

```
app (expo-notifications) ──token──▶ POST /api/me/devices ──▶ push_devices
notify() ──▶ lib/push.ts ──▶ @krizaka/push ──▶ Expo Push Service ──▶ FCM / APNs ──▶ phone
                         ◀── dead tokens (DeviceNotRegistered) are deleted
```

- **Registration**: after sign-in the app asks for permission, gets its Expo push token and registers it
  (`POST /api/me/devices`, `{ token, platform }`). A token belongs to one account at a time — signing in with another
  account on the same phone moves it. Sign-out forgets it (`DELETE /api/me/devices`).
- **Sending**: `pushToUser` sends the notification's subject and text, with `data.path` — tapping the notification
  opens that screen in the app. Batches of 100, never throws; tokens reported dead are deleted.
- **Gate**: pushes leave only in production, or with `PUSH_DELIVERY=on` (local runs and CI never call the service);
  `PUSH_DELIVERY=off` stops them in production too.
- **Why Expo Push and not Firebase directly**: one HTTP call and one kind of token for both platforms, no Admin SDK
  and no service-account key on the server. Firebase is still underneath for Android — its credentials live in the
  app's EAS project (below). Switching to FCM HTTP v1 directly later only changes `@krizaka/push`.

### To turn it on (once)

1. **Expo / EAS** — `npx eas-cli@latest init` in `orochia-mobile` (creates the project and its `projectId`).
2. **Android — Firebase**: create a Firebase project, add an Android app `com.krizaka.orochia`, download
   `google-services.json` (EAS file secret `GOOGLE_SERVICES_JSON`), and upload an FCM v1 service-account key with
   `eas credentials` → Android → *Push Notifications (FCM V1)*.
3. **iOS — APNs**: `eas credentials` → iOS → *Push Notifications* creates (or uploads) the APNs key from the Apple
   Developer account.
4. **Server** (optional): turn on *Enhanced push security* in the Expo project and set `EXPO_ACCESS_TOKEN`.

## 5. Chat and presence (Messenger-style)

Messages are the existing private messages (`direct_messages`), made live — there is no second system.

**One stream per tab or app** — `GET /api/conversations/stream` (cookie or `Authorization: Bearer`), shared in the
browser by the bell, the Messages badge and the inbox (`lib/realtime-client.ts`). Events (`data:` JSON, `type`):

| Event | To | Carries |
| :--- | :--- | :--- |
| `connected` (named event) | the stream | `connectionId`, `resumed`, `serverNow` |
| `new_message` · `message_sent` | the recipient · the sender's other apps | the message, SSE `id: m<seq>` |
| `receipt` | the sender | `conversationId`, `state` (`delivered` · `read`), `upTo` (seq), `at` |
| `read` · `unread` | the reader's apps | a conversation read elsewhere · the account's unread total (the badge) |
| `typing` | the other participant | `conversationId`, `userId`, `typing` — never stored |
| `presence` · `presence_snapshot` | the circle | `userId`, `state` (`online` · `away` · `offline`), `lastSeenAt` · the circle at once |
| `circle_changed` · `resync` | the stream | reload presence (a block, a contact, a setting) · reload (too much missed) |
| `notification` | the account | as before (§1) |

**Order, duplicates, resume.** `seq` (bigserial) is assigned under the conversation's row lock, so a conversation
commits in `seq` order; the app sends a `clientId` (UUID) with each message and a retry answers the stored message
(`200`, `duplicate: true`) instead of a second one. A reconnection sends `Last-Event-ID: m<seq>` (or `?after=<seq>`):
the stream replays the messages since (with a 10 s overlap for transactions committed late), then goes live; clients
drop duplicates by id. More than 500 missed → `resync`.

**Receipts.** Sent = stored. Delivered = handed to one of the recipient's open streams, or the recipient's app listed
its conversations. Read = the conversation open and visible (`POST /api/conversations/:id/read { upTo }`, or opening
its latest page).

**Presence** (`lib/presence.ts`, rule in `lib/presence-rules.ts`). Each open stream is a heartbeat (15 s, TTL 45 s);
`POST /api/presence { connectionId, state }` says `away` (tab hidden, 3 min idle) or `online` again; a closed stream
lingers 10 s so a reconnection does not flicker. `users.last_seen_at` is written once, when the last app closes.
**Who sees whom**: two active accounts, no block either way (messaging block or blocked contact), both showing their
presence (*Settings → Privacy*, `profiles.show_presence` — hiding yours hides everyone else's from you), and an
accepted contact, an **exchange** (both have written in a shared conversation — opening a conversation or writing into
the void is not enough) or an **approved follow of a creator** (the fan sees the creator, not the reverse).
Administrators get no exception. `GET /api/presence?ids=` answers only the visible ones;
`GET /api/presence/online` is "Online now".

**Moderation and limits.** The recipient reports a message (`POST /api/conversations/:id/messages/:messageId/report`
→ `compliance_reports.message_id`, the text copied into the report); blocking closes messages, typing and presence at
once. Limits per account (and IP): messages 20/min burst and 300/h, typing 40/min, read 240/min, presence 60/min.
No attachments, reactions or paid messages: none exists in the messaging model yet — they would be a product decision
of their own.

**Phones.** In the foreground the app holds the same stream; a message to someone whose presence is `online` (an
Orochia screen open and active) is not pushed to their phone — it is on screen already; otherwise push as in §4.

**Deploying.** App Platform has no session affinity and cuts requests idle for 100 s: the stream sends a heartbeat
every 15 s, ends itself after `REALTIME_STREAM_MAX_SECONDS` (300) — the client reconnects at once and resumes — and
needs no affinity (any instance serves any stream). Before a second instance: `RATE_LIMIT_STORE=postgres`; past ~3
instances, `REALTIME_BUS=redis` (DigitalOcean Managed Caching, Valkey) — [DEPLOYMENT.md](DEPLOYMENT.md).

**Measure it.** `node scripts/realtime-load.mjs --url … --streams 500 [--send-url <second instance>] [--pid …]`
(development data only).

## 6. Where the code is

```
@krizaka/realtime (npm)                  the bus interface, memory / PostgreSQL / Redis adapters, presence, SSE framing
apps/web/lib/realtime.ts                 the door: picks the bus (REALTIME_BUS), publish / subscribe / sseResponse
apps/web/lib/realtime.integration.test.ts  the wiring against real PostgreSQL and Valkey (REALTIME_IT=1, CI e2e job)
apps/web/lib/chat-stream.ts              the account's stream: replay, delivery, presence heartbeat, circle filter
apps/web/lib/presence.ts                 circle (SQL), presence views, announcements, last seen
apps/web/lib/presence-rules.ts           who sees whom (pure, tested)
apps/web/lib/messaging.ts                messages, receipts, unread, typing, reports, blocks
apps/web/lib/realtime-client.ts          the browser's single shared stream, activity (away / online)
apps/web/components/messages/            Messages: list, thread, presence avatars, report dialog, useChat
apps/web/lib/notifications.ts            notify(): write, publish, push, e-mail — and every event's helper
apps/web/mail-templates/notification/    the e-mail around a notification (subject and text come from messages/en.json)
apps/web/lib/push.ts                     pushToUser, registerDevice, unregisterDevice, the delivery gate
apps/web/app/api/me/devices/route.ts     register / forget a phone
apps/web/components/notifications/       the bell, the toasts, useNotifications
@krizaka/push (npm)                      the Expo Push client (pure, tested)
packages/db/src/schema/push.ts           push_devices
scripts/realtime-load.mjs                the load test
```
