# 📱 Mobile — the Orochia app for iOS and Android

The app is [`krizaka/orochia-mobile`](https://github.com/krizaka/orochia-mobile): Expo SDK 57, React Native 0.86,
Expo Router. It is a **client of the Orochia API** — the same server, the same rules as orochia.com: access, prices,
balances and moderation are decided by the server, the app shows what it answers.

What this page describes was **run on 2026-10-12** on the iOS 27 simulator (iPhone 17, Xcode 27) and the Android 16
emulator (Pixel 8 image), signed in against `dev.orochia.com` and against a local Orochia on its development seed. Creating an account in the
app was run on 2026-10-13 on the same simulator (Maestro, end to end) and on the Android emulator, against a local
Orochia in demo mode. Nothing here is a mock-up.

| Platform | State |
| :--- | :--- |
| iOS simulator (iOS 27) | ✅ builds and runs — every screen below, dark and light |
| Android emulator (Android 16) | ✅ development build runs — home, stories, sign-in, creating an account, account, challenges; the **EAS preview APK** (release build, EAS keystore, Firebase inside) installs and reaches the feed of `dev.orochia.com`; an APK is also built by CI on each `v*` tag ([releases](https://github.com/krizaka/orochia-mobile/releases)) |
| iPhone / TestFlight | ❌ waiting for the Apple Developer activation (the EAS project exists: `@oussamaabid/orochia`) |
| Push notifications | ✅ Android, end to end (2026-10-13, emulator `krizaka-pixel`, Google APIs): a local Orochia with `PUSH_DELIVERY=on` → Expo Push → FCM (Firebase `orochia-2026`) → the app; the tap opens the conversation, from a cold start too. Median ≈ 0.5 s from the send to the notification. iOS: the APNs key after the Apple activation ([Notifications](./NOTIFICATIONS.md) §3) |

---

## 1. What the app does today

### The 18+ gate

On a fresh install, before anything else: Orochia is for adults, leaving is one tap. The answer is kept on the
device.

![The 18+ gate on a fresh install](https://krizaka-assets.b-cdn.net/site/docs/orochia/mobile/01-age-gate-dark.d726b8f556.webp)

### Home — stories and the feed

The stories of the creators the viewer may see (a ring per creator, unseen ones in the signature gradient), then the
feed (`GET /api/feed`, `GET /api/stories`). A tile shows the poster, the duration, the creator, the views and what the
video asks (contacts only, approved followers, unlock). Pull to refresh. Signed out, the public feed is shown.

![Home: stories rail and the feed (local seed)](https://krizaka-assets.b-cdn.net/site/docs/orochia/mobile/06-home-dark.79f01c0bf5.webp)
![Home in the light theme](https://krizaka-assets.b-cdn.net/site/docs/orochia/mobile/06-home-light.9a3572b355.webp)

### A story, full screen

A tap on a ring opens the creator's stories: progress bars, tap right for the next one, left for the previous, the
cross to leave. Each story shown is marked viewed (`POST /api/stories/<id>/view`); an image story lasts 5 seconds,
then the next one — and the next creator's — follows.

![A story, full screen](https://krizaka-assets.b-cdn.net/site/docs/orochia/mobile/07-story-dark.a195f81935.webp)

### Watch

A video's page (`GET /api/videos/<id>/details`): the player, the title, the creator, the description and more from
the same creator. The player plays only what `GET /api/videos/<id>/stream` answers, signed for the viewer — never a
raw media URL. With the development seed, whose videos have no real media, the player shows the poster: playback of a
real video was not part of this run.

![Watch (local seed)](https://krizaka-assets.b-cdn.net/site/docs/orochia/mobile/08-watch-dark.c449b6ef16.webp)

### Challenges, auctions, messages

Three tabs read their lists from the API (`/api/challenges`, `/api/auctions`, `/api/conversations`) and open a
challenge (pledge), an auction (bid) or a conversation (live: presence, typing, receipts). In this run the server had
none open, so each tab shows its empty state.

![Challenges with nothing open yet](https://krizaka-assets.b-cdn.net/site/docs/orochia/mobile/09-challenges-dark.374c8264ed.webp)

### Create an account

No more "create one on orochia.com": **Create an account** on the sign-in screen opens the sign-up form, on the same
API and the same rules as the web (the server decides each of them):

- **e-mail**, **username** — checked with the server as it is typed (`GET /api/auth/username`, debounced), with a free one
  offered when it is taken —, an optional **display name**, the **password** with its rule (10 characters at least);
- the **date of birth** (day · month · year): an under-18 date is refused at once, and the server checks it again
  (`UNDERAGE` comes back on the field); it is private, never shown;
- **I am at least 18** and **I accept the Terms of Service and the Privacy Policy** (both linked);
- the server's refusals land on their field (validation, disposable address, reserved username) or above the button
  (an existing account, the anti-bot checks, the per-address limit, the network).

Then **Check your inbox**: the account exists and is signed in, but does nothing until the address is confirmed with the
e-mailed link — opened anywhere. The app checks again when it comes back to the foreground or on "I've confirmed it",
and sends the link again on request; on a demo server only, "Confirm now" does it in place. Once confirmed: signed
in, on the feed. The animated Orochia mark heads these screens and carries every wait.

[![Creating an account in the app: the form, the username checked live, the verification, signed in (iOS 27 simulator, typing sped up)](https://krizaka-assets.b-cdn.net/site/products/orochia/mobile/sign-up.0b93adb258.webp)](https://krizaka-assets.b-cdn.net/site/products/orochia/mobile/sign-up.41756582ac.mp4)

![Create an account](https://krizaka-assets.b-cdn.net/site/docs/orochia/mobile/10-sign-up-dark.300219226f.webp)
![Create an account, light theme](https://krizaka-assets.b-cdn.net/site/docs/orochia/mobile/10-sign-up-light.84a2548d0a.webp)
![A taken username, and the free one offered](https://krizaka-assets.b-cdn.net/site/docs/orochia/mobile/11-username-taken-dark.e13844315d.webp)
![An under-18 date of birth, refused](https://krizaka-assets.b-cdn.net/site/docs/orochia/mobile/12-underage-dark.b3775aa7f9.webp)
![Check your inbox](https://krizaka-assets.b-cdn.net/site/docs/orochia/mobile/13-verify-email-dark.4c99f852a9.webp)
![Check your inbox, light theme](https://krizaka-assets.b-cdn.net/site/docs/orochia/mobile/13-verify-email-light.c856b9d097.webp)

### You — sign in, wallet, earnings, notifications

Sign in with an e-mail or a username and the password. Signed in: the wallet (credits, what is held in bids and
pledges; credits are bought on the web), a creator's earnings over 30 days (charts), the notifications, the public
page and sign-out.

![Sign in](https://krizaka-assets.b-cdn.net/site/docs/orochia/mobile/03-sign-in-dark.14250d077d.webp)
![A creator's account: wallet and earnings (local seed, Elena)](https://krizaka-assets.b-cdn.net/site/docs/orochia/mobile/05-account-earnings-dark.28ce17d1a1.webp)
![The account in the light theme](https://krizaka-assets.b-cdn.net/site/docs/orochia/mobile/04-account-light.85be02b33e.webp)

On Android (development build, Android 16 emulator, local seed):

![Home on Android](https://krizaka-assets.b-cdn.net/site/docs/orochia/mobile/android-home.e54d75548c.webp)
![A creator's account on Android](https://krizaka-assets.b-cdn.net/site/docs/orochia/mobile/android-account.b6d3b7981b.webp)

A short recording of the smoke run (18+ gate → sign in → account → feed):
[ios-smoke.mp4](https://krizaka-assets.b-cdn.net/site/docs/orochia/mobile/ios-smoke.9605d457e2.mp4).

---

## 2. How it signs in

| Step | What happens |
| :--- | :--- |
| Sign in | `POST /api/auth/login` with `client: "native"` → the server answers a **signed session token** (the same one the web keeps in an httpOnly cookie) |
| Sign up | `GET /api/auth/register?client=native` opens the form: a form token bound to the install's **device id** (random, made once, kept in secure storage, sent as `X-Orochia-Device` — what the device cookie is to a browser); `POST /api/auth/register` with `client: "native"` answers the session token, never a cookie. Every web rule applies: automated clients, per-address and per-device limits, the honeypot, the form's minimal fill time, disposable addresses, 18+ from the date of birth, the terms. When Turnstile is on, the app shows the server's `/auth/native-challenge` page in a WebView (Turnstile has no native SDK) and sends its token — the same check, failing closed |
| Verify | until the address is confirmed the app shows the verification step only; once it is, `GET /api/auth/me` answers a refreshed token, which replaces the stored one |
| Keep it | the token goes to the device's secure storage only (`expo-secure-store`: Keychain on iOS, Keystore-backed on Android) — never plain storage, a log or a URL |
| Use it | every call carries `Authorization: Bearer <token>`; the account is read from `GET /api/auth/me` |
| Lose it | a `401` on a signed-in call drops the stored session; a call with no answer gives up after 20 s ("Orochia is out of reach") |
| Sign out | the push token is forgotten on the server (`DELETE /api/me/devices`), then the session |

While signed in and in the foreground, one live stream (`/api/conversations/stream`, Server-Sent Events with the
bearer session) shows toasts and moves the badges; in the background, push (see
[Notifications](./NOTIFICATIONS.md); the live part: [Realtime](./REALTIME.md)). Payments stay on the web, in the provider's checkout: the app never collects
card details.

---

## 3. Run it on a simulator

Requirements: macOS with **Xcode 27** and its iOS simulator runtime (`xcodebuild -downloadPlatform iOS`), CocoaPods
(`brew install cocoapods`), Node 22.

```bash
git clone https://github.com/krizaka/orochia-mobile && cd orochia-mobile
npm ci
# The API the app talks to (read at build time); without it, https://dev.orochia.com.
export EXPO_PUBLIC_OROCHIA_URL=http://localhost:3000   # a local Orochia (the simulator shares the Mac's network)
npx expo run:ios                                       # prebuild, pods, build, install, Metro
```

`ios/` and `android/` are generated (Continuous Native Generation) — configure the app in `app.json` and its plugins,
never in the generated folders. A Release build (no Metro, the bundle inside the app) is
`npx expo run:ios --configuration Release`.

**iOS 27 requires the scene life cycle.** An app built with the iOS 27 SDK is stopped at launch unless it adopts
`UIScene`. Expo SDK 57 ships the scene delegate but its template does not use it yet: the app's
`plugins/with-scene-lifecycle.js` applies it at prebuild (to remove with Expo SDK 58, whose template does).

**Against a local Orochia**: start it (see [Getting Started](./GETTING_STARTED.md)) and sign in with a seeded account
(`npm run db:seed` prints them). The seed gives a feed, stories and a creator's earnings.

**Android**: install the Android SDK with an emulator image (e.g. `brew install --cask android-commandlinetools`, then
`sdkmanager "platform-tools" "emulator" "platforms;android-36" "system-images;android-36;google_apis;arm64-v8a"` and
an AVD), a JDK (17 or 21), then `npx expo run:android`. The emulator reaches the Mac at `10.0.2.2`
(`EXPO_PUBLIC_OROCHIA_URL=http://10.0.2.2:3000` for a local Orochia; a development build allows plain HTTP). On a
phone: the **EAS preview APK** (`npx eas-cli@latest build --platform android --profile preview`, signed with the
project's EAS keystore, push through Firebase) — its install link is on the build's page in the Expo project
`@oussamaabid/orochia`; or the APK attached to each [release](https://github.com/krizaka/orochia-mobile/releases)
(CI build, signed with a debug key, no push). Neither is for a store.

---

## 4. Tests

| | What | Where |
| :--- | :--- | :--- |
| Unit | money and time formatting, the challenge and auction presenters, message ordering, the API client (bearer, refusals, `401`), `useApi` | `src/lib/__tests__` |
| Render | the tiles; **Home** (feed, stories rail, the story viewer, empty, unreachable); **You** (native sign-in, wrong password, the verification step, stored and expired sessions, sign-out); **Create an account** (the button gated, a minor refused, the server's 18+ refusal, username taken and the suggestion, field errors, anti-bot refusals, the Turnstile token, success → verification → signed in, the link sent again, the wait) on API responses recorded from a local Orochia and dev.orochia.com | `src/__tests__`, fixtures in `src/__fixtures__/api` |
| Build | the iOS 27 scene plugin against the SDK 57 template | `plugins/__tests__` |
| Smoke | [Maestro](https://maestro.mobile.dev): 18+ gate → sign in → account → feed, on a simulator; 18+ gate → create an account → confirm the e-mail → feed → account | `.maestro/smoke.yaml`, `.maestro/sign-up.yaml` |

CI (`.github/workflows/ci.yml`) runs lint, type-check, the tests and the iOS and Android bundles on every pull
request. The Maestro flow runs on a Mac with a simulator:

```bash
maestro test .maestro/smoke.yaml -e OROCHIA_ID=<e-mail or username> -e OROCHIA_PASSWORD=<password>
# Sign-up: against a LOCAL Orochia in demo mode (OROCHIA_DEMO_MODE=true) on its own database — never a shared one
maestro test .maestro/sign-up.yaml -e SIGNUP_NAME=eric_$(date +%s)
```

The sign-up flow runs on a Release build (`npx expo run:ios --configuration Release`: no dev server to find after the
app's state is cleared). A local server allows 5 sign-ups an hour per address — restart it to run the flow more often.

---

## 5. What is missing

- **On a phone**: TestFlight needs the Apple Developer activation (then `eas build --platform ios` + `eas submit`). Apple and Google refuse sexually explicit apps in their stores: TestFlight internal
  testers is the way for now.
- **Push**: Android is configured end to end (EAS project, Firebase, FCM V1) but a push has not yet been seen on a
  real phone; iOS needs the APNs key (Apple activation).
- **Android**: a run on a phone, and a release-signed build.
- **Video playback**: proven only up to the player; a run with real media (a creator's uploaded video) is still to do.
- **Stories**: the web viewer's sound, gestures, actions and the "processing" state are not in the app yet
  ([orochia-mobile#3](https://github.com/krizaka/orochia-mobile/issues/3)).
- **Uploading**: creators publish from the web; the app watches, pays, bids, pledges and talks.
- **Sign-up**: the Turnstile step (WebView) is covered by tests on both sides but has not yet run against a deployment
  with Turnstile keys; the form fields are React Native inputs until `@krizaka/ui/native` has its own
  ([krizaka-ui#122](https://github.com/krizaka/krizaka-ui/issues/122)); on Android, Maestro's run reached the
  verification step and the rest was checked by hand.
