// Screenshots of the main pages in the dark AND the light theme, for a UI review (a pull request, a migration).
//
//   npm run dev                      # or any running app: the script never starts one
//   npm run screenshots              # OROCHIA_URL (default http://localhost:3000), OUT (default docs/screenshots/web)
//
// It signs in as a development seed account (SCREENSHOTS_LOGIN / SCREENSHOTS_PASSWORD, default the seed creator) for
// the pages that need a session, picks the first video linked from the home page for /watch/<id>, sets the theme the
// way the app persists it (`kz-theme` in localStorage, read by ThemeScript before the first paint) and turns motion
// off (prefers-reduced-motion) so every capture is the settled page; the 18+ gate is answered. Playwright is a dev dependency of the workspace.
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = (process.env.OROCHIA_URL || "http://localhost:3000").replace(/\/$/, "");
const OUT = path.resolve(process.env.OUT || "docs/screenshots/web");
const LOGIN = process.env.SCREENSHOTS_LOGIN || "elena@orochia.org";
const PASSWORD = process.env.SCREENSHOTS_PASSWORD || "elena1234";
const THEMES = ["dark", "light"];
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("✗ Playwright is missing: npm install (it is a dev dependency), then npx playwright install chromium.");
  process.exit(2);
}

const up = await fetch(BASE).then((r) => r.ok, () => false);
if (!up) {
  console.error(`✗ Nothing answers at ${BASE}: start the app (npm run dev) or set OROCHIA_URL.`);
  process.exit(2);
}

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

/** A context per theme and viewport, signed in when `session` is true. */
async function open(theme, viewport, session) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce", colorScheme: theme, deviceScaleFactor: 1 });
  await context.addInitScript((mode) => {
    try {
      localStorage.setItem("kz-theme", mode);
      localStorage.setItem("orochia_age_verified", "true"); // the 18+ gate, answered
    } catch {}
  }, theme);
  if (session) {
    const res = await context.request.post(`${BASE}/api/auth/login`, { data: { identifier: LOGIN, password: PASSWORD } });
    if (!res.ok()) throw new Error(`sign-in as ${LOGIN} failed (${res.status()}): seed the database (npm run db:seed)`);
  }
  return context;
}

// The first playable video linked from the home page.
const home = await (await fetch(BASE)).text();
const watchId = /href="\/watch\/([0-9a-f-]{36})"/.exec(home)?.[1];

const PAGES = [
  { name: "home", url: "/" },
  { name: "auctions", url: "/auctions" },
  { name: "challenges", url: "/challenges" },
  { name: "dashboard", url: "/dashboard", session: true },
  { name: "settings", url: "/dashboard?tab=settings", session: true },
  ...(watchId ? [{ name: "watch", url: `/watch/${watchId}`, session: true }] : []),
];
if (!watchId) console.warn("! no /watch/<id> link on the home page (no public video): the watch page is skipped.");

const shots = [];
for (const [device, viewport] of Object.entries(VIEWPORTS)) {
  for (const theme of THEMES) {
    for (const session of [false, true]) {
      const pages = PAGES.filter((p) => Boolean(p.session) === session);
      if (pages.length === 0) continue;
      const context = await open(theme, viewport, session);
      const page = await context.newPage();
      for (const p of pages) {
        await page.goto(`${BASE}${p.url}`, { waitUntil: "networkidle", timeout: 60_000 }).catch(() => page.waitForLoadState("load"));
        await page.waitForTimeout(400);
        const file = path.join(OUT, `${p.name}-${device}-${theme}.jpg`);
        await page.screenshot({ path: file, fullPage: device === "desktop", type: "jpeg", quality: 72 });
        shots.push(path.relative(process.cwd(), file));
      }
      await context.close();
    }
  }
}
await browser.close();
console.log(`✓ ${shots.length} screenshots in ${path.relative(process.cwd(), OUT)}`);
for (const s of shots) console.log(`  ${s}`);
