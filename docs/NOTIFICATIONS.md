---
title: Notifications and push
nav: Notifications
description: How an event reaches the bell, the open page, the phone and the inbox.
---

# Notifications & push

Something happens — a follower, a tip, an unlock, a bid, a pledge, a message — and the person it concerns hears of it
**wherever they are**: on an open page (in the second), on their phone (even with the app closed), by e-mail (at the
pace they chose). One event, one row, three channels. How the live part works — the bus, the streams, reconnection,
presence — is in [REALTIME.md](REALTIME.md).

---

## 1. The channels

| Where the person is | Channel | How |
| :--- | :--- | :--- |
| A page of orochia.com is open | **Server-Sent Events** | the account's stream (`/api/conversations/stream`, topic `user:<id>`): the bell's count moves, a **toast** slides in, the list updates |
| The Orochia app is in front | **Server-Sent Events** | the same stream, with the native session as `Authorization: Bearer`: a toast, the account tab's badge |
| The app is closed or in the background | **Push** | Expo Push Service → **FCM** (Android) / **APNs** (iOS), to every phone registered by the account |
| Away | **E-mail** | `INSTANT`, `HOURLY` or `NONE` (`profiles.email_frequency`) |

```
 an action ──▶ notify()  (apps/web/lib/notifications.ts)
                 │
                 ├─ wanted in the app? (profiles.in_app_off) ── no ──▶ (no row, no live, no push)
                 │      yes
                 ├─▶ INSERT notifications                         the bell, /notifications — the source of truth
                 ├─▶ publish user:<id> { type: "notification" }   open pages and apps: a toast (REALTIME.md)
                 ├─▶ pushToUser()  (lib/push.ts)                  the phones, in the background (§3)
                 │
                 └─ wanted by e-mail? (profiles.notifications_off, verified address, frequency, throttles)
                        └─▶ the notification e-mail
```

`notify()` never throws and never decides anything: it runs after the action, best-effort.

## 2. Preferences

Every event is on by default, in the app and by e-mail; each can be turned off on either side.

- **Web** — *Settings → Notifications*: one switch per event and channel, the e-mail pace.
- **App** — *You → Notification settings* (`orochia://settings/notifications`): one switch **per kind** (messages,
  followers and contacts, comments, tips and unlocks, videos, auctions, challenges, storage) — 30 switches would be read
  by nobody. A kind writes all its events into the same `in_app_off` list; an event turned off on the web shows its kind
  as off. If the phone itself refuses Orochia's notifications, the screen says so first, with the way to the system
  settings.
- The "in the app" side (`in_app_off`) covers **the bell, the toasts and the push** together: a push only ever repeats
  what the bell shows.
- **Messages** ring the phone only when no Orochia screen of the recipient is in front of them (presence `online`): an
  open page or app already shows the message live. E-mail for a conversation: at most one an hour.

## 3. Mobile push

```
 app (expo-notifications)
   ├─ after sign-in: permission (asked once) → Android channel "default" (high importance)
   ├─ getExpoPushTokenAsync({ projectId }) ──▶ POST /api/me/devices { token, platform } ──▶ push_devices
   └─ sign-out: DELETE /api/me/devices { token }

 notify() ──▶ pushToUser(userId, { title, body, path })                       apps/web/lib/push.ts
              └─▶ @krizaka/push: POST https://exp.host/--/api/v2/push/send (batches of 100)
                    └─▶ Expo Push Service ──▶ FCM (Android) / APNs (iOS) ──▶ the phone
              ◀── tickets: DeviceNotRegistered → the token is deleted

 the phone: a notification "title — text"; tapped ──▶ data.path ──▶ openPath() ──▶ the native screen (or the web page)
```

- **Registration** (`POST /api/me/devices`, signed in, 20 an hour): only an Expo push token (`ExponentPushToken[…]`)
  is stored. A token belongs to one account at a time — signing in with another account on the same phone moves it.
  Sign-out forgets it.
- **What is sent**: the event's subject as the title, its text as the body, `data.path` (what the tap opens), the
  Android channel `default` that the app creates with **high importance** (a heads-up banner, not a silent line in the
  shade) and the default **sound** (iOS rings). One message per phone, never throws; the tokens the service reports dead
  are deleted.
- **Tap → screen**: `useOpenTappedPush` (orochia-mobile `src/lib/push.ts`) opens `data.path` through `openPath`
  (`src/lib/links.ts`): a conversation, an auction, a challenge, a video natively; anything else on orochia.com. It
  works while the app runs **and when the tap launched it** (a cold start), each notification once — the launch
  response is cleared once opened, so a later start does not reopen it.
- **In front**, the app shows the live stream's toasts; a push arriving then goes to the list only (no double banner).
- **Gate**: pushes leave only in production, or with `PUSH_DELIVERY=on` (local runs and CI never call the service);
  `PUSH_DELIVERY=off` stops them in production too.
- **Why Expo Push and not Firebase directly**: one HTTP call and one kind of token for both platforms, no Admin SDK and
  no service-account key on the server. Firebase is still underneath for Android — its credentials live in the app's
  EAS project. Switching to FCM HTTP v1 directly later only changes `@krizaka/push`.

### What is configured

| | State |
| :--- | :--- |
| Expo / EAS | project `@oussamaabid/orochia` (`extra.eas.projectId` in orochia-mobile `app.json`) |
| Android | Firebase project `orochia-2026`, app `com.krizaka.orochia`; `google-services.json` as the EAS file variable `GOOGLE_SERVICES_JSON`; FCM V1 service-account key uploaded to the project's EAS credentials |
| iOS | **waiting for the Apple Developer activation**: then `eas credentials` → iOS → *Push Notifications* (create or upload the APNs `.p8` key), `eas build --platform ios`, TestFlight. Nothing changes on the server or in the app's code |
| Server | nothing to set: production sends by default. `PUSH_ACCESS_TOKEN` only if *Enhanced push security* is turned on in the Expo project (it is off) |

## 4. How to test it

| Level | What | Where |
| :--- | :--- | :--- |
| Package | the Expo Push client: batches of 100, tickets, dead tokens, never throws | `@krizaka/push` (krizaka/krizaka-ui `packages/push/test`) |
| Unit | the gate, one message per phone (title, text, path, channel, sound), access token, dead tokens forgotten (only those), never throws, registration and forgetting | `apps/web/lib/push.test.ts` |
| e2e | a phone registered, a non-token refused, a token moving accounts, forgotten at sign-out; notifications written for comments, bids, an outbid, a won auction, a delivered challenge; a notification live on its owner's stream only | `e2e/scenarios.mjs` |
| App | permission asked once, registration and forgetting, tap → screen (running and cold start, once), every path → its screen, preferences by kind and their screen | krizaka/orochia-mobile `src/lib/__tests__`, `src/__tests__/screens` |

**A real push, end to end** (Android emulator with Google APIs, or a phone):

1. Run Orochia with `PUSH_DELIVERY=on` (or use dev.orochia.com, which sends).
2. Install an app built with `google-services.json` and pointed at that server — the EAS `preview` APK (dev.orochia.com),
   or a local `npx expo run:android --variant release` with `GOOGLE_SERVICES_JSON=<path>` and
   `EXPO_PUBLIC_APP_URL=<server>` (from the emulator, the Mac is `http://10.0.2.2:<port>`).
3. Sign in, allow notifications, send the app to the background.
4. From another account, do something that notifies (follow, tip, comment, send a message): the notification arrives
   in a few seconds; tap it — the app opens on that screen.

**Proven on 2026-10-13** (emulator `krizaka-pixel`, Android 16 with Google APIs, a local Orochia with
`PUSH_DELIVERY=on`, the app built with Firebase `orochia-2026`): Alex's message to Elena, her app in the background →
*New message from Alex Vance* in the shade; the tap opens the conversation. From the send to the notification on
screen: 1.24 s the first time, then 0.50 · 0.52 · 0.55 · 0.50 · 0.76 s (median ≈ 0.53 s over 6 sends, timed by polling
the emulator's notification list). Note: an emulator is *not a device* for `expo-device` — the app registers there
anyway (krizaka/orochia-mobile#29); only an iOS simulator gets no token. The recording of this run: [live-push.mp4](https://krizaka-assets.b-cdn.net/site/products/orochia/mobile/live-push.6573b79033.mp4).

## 5. Where the code is

```
apps/web/lib/notifications.ts            notify(): write, publish, push, e-mail — and every event's helper
apps/web/lib/push.ts                     pushToUser, registerDevice, unregisterDevice, the delivery gate
apps/web/app/api/me/devices/route.ts     register / forget a phone
apps/web/app/api/me/profile/route.ts     preferences (inAppOff, notificationsOff, emailFrequency)
apps/web/mail-templates/notification/    the e-mail around a notification (subject and text from messages/en.json)
apps/web/components/notifications/       the bell, the toasts, useNotifications
packages/db/src/schema/push.ts           push_devices
@krizaka/push (npm)                      the Expo Push client (pure, tested)
krizaka/orochia-mobile src/lib/push.ts   permission, token, registration, tap → screen
krizaka/orochia-mobile src/lib/notification-prefs.ts, src/app/settings/notifications.tsx   preferences by kind
```

## Language

An account keeps the language it reads Orochia in (`users.locale`, `en` or `fr`; chosen with the language switch,
`PUT /api/me/locale`, or taken from the page at sign-up). A notification is stored as an event and its variables, and written
when it leaves the server — live (SSE), push and e-mail — in the **recipient's** language, never the one of whoever caused
it; the bell is written in the language of the page. Words inside variables are stored as keys (`i18nVar`) and amounts as
cents (`moneyVar`). E-mails use the matching `fr` template and link to the French address (`/fr/…`) so the page opens in the
same language on any device. An invitation to someone without an account uses the inviter's language.
