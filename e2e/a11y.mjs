#!/usr/bin/env node
/**
 * Accessibility of the key pages — axe-core (WCAG 2.0/2.1/2.2, levels A and AA) against a running Orochia on a seeded
 * database, in the dark AND the light theme, on a desktop and a phone viewport.
 *
 *   npm run db:seed && npm run dev            # in another terminal
 *   npm run test:a11y                         # APP_URL defaults to http://localhost:3000
 *
 * Pages: home (and its 18+ gate), explore, watch (and the tip / unlock dialog), a creator's profile, auctions,
 * challenges, sign-in, sign-up, and — signed in — messages, the dashboard and the wallet (adding credits).
 * Any violation fails the run, with the rule, the WCAG criterion, the selector and the help URL (docs/ACCESSIBILITY.md).
 * Read-only: it signs in, opens pages and dialogs, never submits anything.
 */
const BASE = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const MEMBER = { identifier: "alex@sanctuary.io", password: "alex1234" }; // a seed member (npm run db:seed)
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const THEMES = ["dark", "light"];
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };

let chromium, AxeBuilder;
try {
  ({ chromium } = await import("playwright"));
  ({ default: AxeBuilder } = await import("@axe-core/playwright"));
} catch {
  console.error("✗ Playwright or @axe-core/playwright is missing: npm install, then npx playwright install chromium.");
  process.exit(2);
}

const home = await fetch(BASE).then((r) => (r.ok ? r.text() : null), () => null);
if (home === null) {
  console.error(`✗ Nothing answers at ${BASE}: start the app (npm run dev) or set APP_URL.`);
  process.exit(2);
}
const watchId = /href="\/watch\/([0-9a-f-]{36})"/.exec(home)?.[1];
const creator = /href="\/@([A-Za-z0-9_.-]+)"/.exec(home)?.[1];

/** Each page: its path, whether it needs a session, and an optional step that opens what must be checked too. */
const PAGES = [
  { name: "home", url: "/" },
  { name: "18+ gate", url: "/", gate: true, wait: '[role="dialog"]' },
  { name: "explore", url: "/explore" },
  { name: "auctions", url: "/auctions" },
  { name: "challenges", url: "/challenges" },
  { name: "sign-in", url: "/auth/login" },
  { name: "sign-up", url: "/auth/register" },
  ...(creator ? [{ name: "creator profile", url: `/@${creator}` }] : []),
  ...(watchId
    ? [
        { name: "watch", url: `/watch/${watchId}` },
        { name: "watch · tip / unlock", url: `/watch/${watchId}`, session: true, open: "watch-tip", wait: '[role="dialog"]' },
      ]
    : []),
  { name: "messages", url: "/messages", session: true },
  { name: "dashboard", url: "/dashboard", session: true },
  { name: "wallet · add credits", url: "/wallet", session: true },
];
for (const [what, found] of [["/watch/<id>", watchId], ["/@<username>", creator]]) {
  if (!found) console.warn(`! no ${what} link on the home page (seed the database): that page is skipped.`);
}

const browser = await chromium.launch();
let failures = 0;
let checked = 0;

// One sign-in for the whole run (sign-ins are rate-limited): its cookie is reused by every signed-in page.
const signIn = await browser.newContext();
const res = await signIn.request.post(`${BASE}/api/auth/login`, { data: MEMBER });
if (!res.ok()) {
  console.error(`✗ sign-in as ${MEMBER.identifier} failed (${res.status()}): seed the database (npm run db:seed)`);
  process.exit(2);
}
const signedIn = await signIn.storageState();
await signIn.close();

async function open(theme, viewport, { session, gate }) {
  const context = await browser.newContext({
    viewport,
    colorScheme: theme,
    reducedMotion: "reduce",
    ...(session ? { storageState: signedIn } : {}),
  });
  await context.addInitScript(
    ([mode, answered]) => {
      try {
        localStorage.setItem("kz-theme", mode);
        if (answered) localStorage.setItem("orochia_age_verified", "true");
      } catch {}
    },
    [theme, !gate],
  );
  return context;
}

/** Opens what the page hides behind a click (a dialog), so axe sees it too. */
async function reveal(page, step) {
  if (step === "watch-tip") {
    await page.getByRole("button", { name: /^(Send a tip|Unlock)/i }).first().click();
  }
}

/** Opens a page (and what it hides behind a click), then runs axe on it — or on its dialog alone. */
async function audit(p, theme, viewport) {
  const context = await open(theme, viewport, p);
  try {
    const page = await context.newPage();
    await page.goto(`${BASE}${p.url}`, { waitUntil: "networkidle", timeout: 60_000 }).catch(() => page.waitForLoadState("load"));
    if (p.open) await reveal(page, p.open);
    if (p.wait) await page.waitForSelector(p.wait, { timeout: 10_000 });
    await page.waitForTimeout(300);
    const builder = new AxeBuilder({ page }).withTags(TAGS);
    // A dialog is checked on its own: what is behind it is inert and checked by its own page.
    if (p.wait) builder.include(p.wait);
    return (await builder.analyze()).violations;
  } finally {
    await context.close();
  }
}

// A development server compiles each route on its first request (and may reload the page meanwhile): warm them up.
for (const p of PAGES) await fetch(`${BASE}${p.url}`).catch(() => {});

for (const [device, viewport] of Object.entries(VIEWPORTS)) {
  for (const theme of THEMES) {
    for (const p of PAGES) {
      const label = `${p.name} · ${theme} · ${device}`;
      let violations;
      for (let attempt = 1; attempt <= 2 && !violations; attempt++) {
        try {
          violations = await audit(p, theme, viewport);
        } catch (error) {
          // A navigation in the middle (a recompile) is retried once; anything else is a failure.
          if (attempt === 2) console.log(`✗ ${label}  ${error.message.split("\n")[0]}`);
        }
      }
      if (!violations) {
        failures++;
        continue;
      }
      checked++;
      if (violations.length === 0) {
        console.log(`✓ ${label}`);
        continue;
      }
      failures++;
      console.log(`✗ ${label}`);
      for (const v of violations) {
        const criteria = v.tags.filter((t) => /^wcag\d{3,}$/.test(t)).join(" ");
        console.log(`    ${v.id} (${v.impact}; ${criteria}) — ${v.help}\n      ${v.helpUrl}`);
        for (const n of v.nodes.slice(0, 5)) console.log(`      · ${n.target.join(" ")}  ${n.failureSummary?.split("\n")[1]?.trim() ?? ""}`);
        if (v.nodes.length > 5) console.log(`      … ${v.nodes.length - 5} more`);
      }
    }
  }
}
await browser.close();
console.log(`\n${failures === 0 ? "✓" : "✗"} ${checked} page views checked against WCAG 2.2 A/AA, ${failures} with violations`);
process.exit(failures === 0 ? 0 : 1);
