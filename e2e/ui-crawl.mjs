#!/usr/bin/env node
/**
 * The UI crawl (Dev preview: `ui.krizaka-ui` + `ui.themes-devices`, orochia#241) — the key screens in dark AND light, on a
 * desktop and a phone viewport, against a running Orochia on a seeded database:
 *
 *   - no console error and no uncaught page error;
 *   - no horizontal scroll (nothing cut at the side);
 *   - exactly one footer (« A Krizaka product ») and a navigation landmark;
 *   - no broken picture (an <img> that loaded nothing) and no empty tile (an anchor/button that renders nothing);
 *   - no hard-coded colour in the inline styles of the page (the tokens are `var(--kz-*)` / theme classes);
 *   - a capture of each screen when `OUT` is set (the set goes to Bunny `pr-assets/orochia/dev-preview/`, never to git).
 *
 *   npm run db:seed && npm run dev     # in another terminal
 *   npm run test:ui-crawl              # APP_URL defaults to http://localhost:3000
 *   OUT=/tmp/orochia-crawl npm run test:ui-crawl
 *
 * Read-only: it opens pages, never submits anything. Axe (WCAG) is e2e/a11y.mjs; this is the layout and family contract.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const OUT = process.env.OUT || "";
const MEMBER = { identifier: "alex@sanctuary.io", password: "alex1234" }; // a seed member (npm run db:seed)
const THEMES = ["dark", "light"];
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };

/** Console messages that are not Orochia's (a blocked third-party beacon, the dev server's own notices). */
const IGNORED_CONSOLE = [/Download the React DevTools/i, /\[Fast Refresh\]/i, /favicon/i, /Failed to load resource.*(401|403|404)/i];

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("✗ Playwright is missing: npm install, then npx playwright install chromium.");
  process.exit(2);
}

const home = await fetch(BASE).then((r) => (r.ok ? r.text() : null), () => null);
if (home === null) {
  console.error(`✗ Nothing answers at ${BASE}: start the app (npm run dev) or set APP_URL.`);
  process.exit(2);
}
const watchId = /href="\/watch\/([0-9a-f-]{36})"/.exec(home)?.[1];
const creator = /href="\/@([A-Za-z0-9_.-]+)"/.exec(home)?.[1];

/** The key screens: public ones, then signed-in ones. */
const PAGES = [
  { name: "home", url: "/" },
  { name: "explore", url: "/explore" },
  { name: "how-it-works", url: "/how-it-works" },
  { name: "auctions", url: "/auctions" },
  { name: "challenges", url: "/challenges" },
  { name: "sign-in", url: "/auth/login" },
  { name: "terms", url: "/legal/terms" },
  ...(creator ? [{ name: "creator-profile", url: `/@${creator}` }] : []),
  ...(watchId ? [{ name: "watch", url: `/watch/${watchId}` }] : []),
  { name: "messages", url: "/messages", session: true },
  { name: "me", url: "/me", session: true },
  { name: "settings", url: "/me/settings", session: true },
  { name: "wallet", url: "/wallet", session: true },
];

if (OUT) mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

const signIn = await browser.newContext();
const res = await signIn.request.post(`${BASE}/api/auth/login`, { data: MEMBER });
if (!res.ok()) {
  console.error(`✗ sign-in as ${MEMBER.identifier} failed (${res.status()}): seed the database (npm run db:seed)`);
  process.exit(2);
}
const signedIn = await signIn.storageState();
await signIn.close();

/** What the page itself says about its layout and family contract (run in the page). */
function inspect() {
  const problems = [];
  const doc = document.documentElement;
  if (doc.scrollWidth > doc.clientWidth + 1) problems.push(`horizontal scroll (${doc.scrollWidth}px in a ${doc.clientWidth}px viewport)`);
  const footers = document.querySelectorAll("footer");
  const topFooters = [...footers].filter((f) => !f.closest("main, article, section, dialog, [role=dialog]"));
  if (topFooters.length !== 1) problems.push(`${topFooters.length} page footers (one « A Krizaka product » footer expected)`);
  else if (!/krizaka/i.test(topFooters[0].textContent || "")) problems.push("the footer does not name Krizaka");
  if (!document.querySelector("nav")) problems.push("no <nav> landmark");
  for (const img of document.querySelectorAll("img")) {
    const box = img.getBoundingClientRect();
    if (box.width > 8 && box.height > 8 && img.complete && img.naturalWidth === 0 && img.currentSrc) problems.push(`broken picture ${img.currentSrc.slice(0, 80)}`);
  }
  for (const el of document.querySelectorAll("main a[href], main button")) {
    const box = el.getBoundingClientRect();
    const visible = getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none";
    if (visible && box.width > 0 && box.height > 0 && box.height < 4) problems.push(`collapsed control ${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}`);
    else if (visible && box.width > 24 && box.height > 24 && !el.textContent?.trim() && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby") && !el.querySelector("img, svg, video, picture, canvas")) problems.push("empty tile (a control with nothing in it)");
  }
  const hard = [...document.querySelectorAll("[style]")].filter((e) => /#[0-9a-f]{3,8}\b|rgba?\(/i.test(e.getAttribute("style") || "") && !/var\(/.test(e.getAttribute("style") || ""));
  if (hard.length > 0) problems.push(`${hard.length} element(s) with a hard-coded colour in an inline style`);
  return [...new Set(problems)];
}

async function crawl(p, theme, device, viewport) {
  const context = await browser.newContext({ viewport, colorScheme: theme, reducedMotion: "reduce", ...(p.session ? { storageState: signedIn } : {}) });
  await context.addInitScript(
    (mode) => {
      try {
        localStorage.setItem("kz-theme", mode);
        localStorage.setItem("orochia_age_verified", "true");
      } catch {}
    },
    theme,
  );
  const consoleErrors = [];
  try {
    const page = await context.newPage();
    page.on("console", (m) => m.type() === "error" && !IGNORED_CONSOLE.some((re) => re.test(m.text())) && consoleErrors.push(m.text().slice(0, 160)));
    page.on("pageerror", (e) => consoleErrors.push(`uncaught: ${e.message.slice(0, 160)}`));
    await page.goto(`${BASE}${p.url}`, { waitUntil: "networkidle", timeout: 60_000 }).catch(() => page.waitForLoadState("load"));
    await page.waitForTimeout(400);
    const problems = await page.evaluate(inspect);
    if (consoleErrors.length > 0) problems.push(...consoleErrors.slice(0, 3).map((m) => `console: ${m}`));
    if (OUT) await page.screenshot({ path: join(OUT, `${p.name}.${theme}.${device}.png`), fullPage: false });
    return problems;
  } finally {
    await context.close();
  }
}

// A development server compiles each route on its first request: warm them up.
for (const p of PAGES) await fetch(`${BASE}${p.url}`).catch(() => {});

let failures = 0;
let checked = 0;
for (const [device, viewport] of Object.entries(VIEWPORTS)) {
  for (const theme of THEMES) {
    for (const p of PAGES) {
      const label = `${p.name} · ${theme} · ${device}`;
      let problems;
      for (let attempt = 1; attempt <= 2 && !problems; attempt++) {
        try {
          problems = await crawl(p, theme, device, viewport);
        } catch (error) {
          if (attempt === 2) problems = [`could not be crawled: ${error.message.split("\n")[0]}`];
        }
      }
      checked++;
      if (problems.length === 0) console.log(`✓ ${label}`);
      else {
        failures++;
        console.log(`✗ ${label}`);
        for (const problem of problems) console.log(`    · ${problem}`);
      }
    }
  }
}
await browser.close();
console.log(`\n${checked - failures}/${checked} screens clean${OUT ? `, captures in ${OUT}` : ""}`);
process.exit(failures > 0 ? 1 : 0);
