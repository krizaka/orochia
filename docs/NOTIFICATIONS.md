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
- **Reconnection is built in** (`EventSource` retries by itself); a reconnection reloads the state, so nothing missed
  while offline stays missing.
- **No sticky sessions**: any instance serves any stream, because the fan-out happens in PostgreSQL (below).

WebSocket would pay for a full-duplex channel nobody uses, and ask for sticky routing or a pub/sub tier to fan out
between instances. It becomes the right tool only for high-frequency client → server traffic (live video chat,
cursors, games) — none of which Orochia has.

## 3. One bus, no broker

`apps/web/lib/realtime.ts` is the only door: `publish(topic, event)` → PostgreSQL `NOTIFY orochia_events` → every
instance's `LISTEN` connection → the SSE streams it holds. Topics: `user:<id>` (notifications, messages),
`auction:<id>`, `challenge:<id>`. Payloads are small facts (≤ 8 KB), never documents.

**A separate "realtime" service?** Not now. A dedicated service (or Redis / NATS) would add a deployment, a hop and a
monthly bill to carry what the database the app already pays for carries well below its limits. The day it is needed
— several products publishing to the same people, ~10 k concurrent streams, durable replay — `realtime.ts` is the one
file whose body changes; its callers do not. The push client is already a package of its own (`packages/push`), ready
to move to a shared Krizaka repository when a second product needs it.

## 4. Mobile push

```
app (expo-notifications) ──token──▶ POST /api/me/devices ──▶ push_devices
notify() ──▶ lib/push.ts ──▶ packages/push ──▶ Expo Push Service ──▶ FCM / APNs ──▶ phone
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
  app's EAS project (below). Switching to FCM HTTP v1 directly later only changes `packages/push`.

### To turn it on (once)

1. **Expo / EAS** — `npx eas-cli@latest init` in `orochia-mobile` (creates the project and its `projectId`).
2. **Android — Firebase**: create a Firebase project, add an Android app `com.krizaka.orochia`, download
   `google-services.json` (EAS file secret `GOOGLE_SERVICES_JSON`), and upload an FCM v1 service-account key with
   `eas credentials` → Android → *Push Notifications (FCM V1)*.
3. **iOS — APNs**: `eas credentials` → iOS → *Push Notifications* creates (or uploads) the APNs key from the Apple
   Developer account.
4. **Server** (optional): turn on *Enhanced push security* in the Expo project and set `EXPO_ACCESS_TOKEN`.

## 5. Where the code is

```
apps/web/lib/notifications.ts            notify(): write, publish, push, e-mail — and every event's helper
apps/web/mail-templates/notification/    the e-mail around a notification (subject and text come from messages/en.json)
apps/web/lib/realtime.ts                 the bus (PostgreSQL LISTEN/NOTIFY) and sseResponse()
apps/web/lib/push.ts                     pushToUser, registerDevice, unregisterDevice, the delivery gate
apps/web/app/api/me/devices/route.ts     register / forget a phone
apps/web/components/notifications/       the bell, the toasts, useNotifications (the stream)
packages/push/                           the Expo Push client (pure, tested)
packages/db/src/schema/push.ts           push_devices
```
