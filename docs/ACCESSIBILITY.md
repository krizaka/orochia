# Accessibility

Orochia aims at **WCAG 2.2 level AA** on the web (`apps/web`) and in the iOS / Android app
([orochia-mobile](https://github.com/krizaka/orochia-mobile)). This page says what is tested on every change, what a
person checked by hand and when, what we know is still missing, and how to tell us. Something blocks you? Say it in
[the accessibility discussion](https://github.com/krizaka/orochia/discussions/133).

---

## 1. What every change is tested against

### Web — `npm run test:a11y` (`e2e/a11y.mjs`, in the CI's e2e job)

[axe-core](https://github.com/dequelabs/axe-core) through `@axe-core/playwright`, rules **WCAG 2.0, 2.1 and 2.2, levels A
and AA**, against the app running on its seeded database, in the **dark and the light theme**, on a **desktop
(1440 × 900) and a phone (390 × 844)** viewport — 52 page views:

| View | Signed in |
| :--- | :--- |
| home · the 18+ gate (the dialog itself) · explore · auctions · challenges | no |
| sign-in · sign-up · a creator's profile (`/@username`) · watch | no |
| watch with the **tip / unlock dialog** open · messages · dashboard · wallet (adding credits) | yes |

Any violation fails the run, with the rule, the WCAG criterion, the element and the help link. The same script checks
what axe cannot see, with the **keyboard only**:

- the first Tab on a page focuses **Skip to content**, and Enter + Tab lands inside `<main>` (2.4.1);
- the tip / unlock dialog takes the focus when it opens, keeps it (20 Tabs stay inside), and **gives it back to the
  button that opened it** on Escape (2.4.3) — every dialog and sheet of the app does the same
  (`components/ui/client.tsx`).

And in the unit tests: `apps/web/lib/text-contrast.test.ts` refuses a fill colour used on text (`text-accent`,
`text-success`…) — coloured words use the text roles of @krizaka/tailwind (`text-fg-accent`…), ≥ 4.5:1 on every surface
in both themes. The colour tokens themselves are contrast-tested in [@krizaka/tokens](https://github.com/krizaka/krizaka-ui).

### Mobile — the render tests (`src/test/a11y.ts`, `src/__tests__/a11y.test.tsx` in orochia-mobile)

Every key screen is rendered in the states a person meets — the 18+ gate, sign-in, the account signed in, sign-up,
notification settings, home (feed, empty, out of reach, a story open full screen), messages, auctions, challenges,
watch — and `a11yProblems()` reports:

- anything that can be pressed without a **role** or a **name** (4.1.2);
- a press target given a size under **44 × 44 pt**, `hitSlop` included (Apple HIG; 2.5.5);
- text that refuses or caps the **system font size** (`allowFontScaling={false}`, `maxFontSizeMultiplier` under 2 — 1.4.4);
- an image exposed to the screen reader without a name (1.1.1).

## 2. The manual pass

Recorded on **2026-10-13** (krizaka/orochia#130), on the development seed.

| Check | How | Result |
| :--- | :--- | :--- |
| Keyboard only (web) | Tab / Shift-Tab / Enter / Escape through home, watch, sign-in, messages; the tip dialog | No skip link (10 stops before the content) and focus lost to `<body>` after closing a dialog → **fixed** (#132), now in CI |
| Contrast (web) | axe, both themes | Accent and success text at 2.6–3.4:1 on sign-in, sign-up, wallet, the tip dialog → **fixed** (#131), now in CI |
| Reflow and 200 % zoom (web) | 11 key pages at 320 and 640 CSS px (= 400 % and 200 % zoom of a 1280 px window); root text at 200 % | No horizontal scroll, no overflow |
| Reduced motion (web) | `prefers-reduced-motion: reduce` on the 11 key pages | No animation left running |
| Screen reader names (app) | render checks above | The story's previous / next zones were unnamed → **fixed**; four small buttons under 44 pt → **fixed** (orochia-mobile#33) |
| Operator console | axe (WCAG 2.2 A/AA) on sign-in and the ten screens, dark and light; keyboard | 19 contrast failures (accent, muted, success/warning text) and no skip link → **fixed** (orochia-admin#21) |
| VoiceOver (iOS simulator), TalkBack (Android emulator), larger text, reduce motion (app) | see §3 | **Not yet recorded** — [orochia-mobile#34](https://github.com/krizaka/orochia-mobile/issues/34) |

## 3. Known gaps

- **VoiceOver and TalkBack passes** on a device or simulator are still to be recorded (the render tests check names,
  roles and targets, not the reading order nor the announcements of live regions):
  [orochia-mobile#34](https://github.com/krizaka/orochia-mobile/issues/34), with the path to walk.
- **Captions**: videos have no captions yet; Bunny Stream's captions arrive with Explore phase 1 (#59).
- **Stories** advance on their own (like every stories format); a screen-reader user moves with the named
  *Previous story* / *Next story* buttons, but the timer does not yet pause while VoiceOver or TalkBack is on.
- **The operator console** ([orochia-admin](https://github.com/krizaka/orochia-admin)) had its pass by hand (§2) and a
  unit test keeps its words in the text roles; an axe step in its CI needs a running Orochia behind it — not yet.
- **French**: the interface is English only for now (#74); a screen reader set to French reads English words.
- Fixes that belong to the shared kit are asked there and carried here until they ship: focus back to the opener
  (krizaka/krizaka-ui#133), a `SkipLink` (krizaka/krizaka-ui#134), 44 pt `Button` on the phone (krizaka/krizaka-ui#136).

## 4. How to report

- In [the accessibility discussion](https://github.com/krizaka/orochia/discussions/133): the page or screen, your device,
  and the assistive technology (screen reader, zoom, switch, voice control…). Every report gets an answer; a defect
  becomes an issue linked back to it.
- A new screen or component is not done until it passes `npm run test:a11y` (web) or `a11yProblems()` in its render test
  (app), in both themes.
