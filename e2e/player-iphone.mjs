#!/usr/bin/env node
/**
 * The watch page's player on an iPhone (orochia#275) — WebKit with the iPhone device profile, touch taps.
 * Every control must be the element hit at its own centre (`elementFromPoint`), play/pause/mute/seek must act,
 * and full screen must reach the <video>'s `webkitEnterFullscreen` (iPhone Safari has no fullscreen on a container).
 *
 *   APP_URL=https://dev.orochia.com npm run test:player-iphone    # APP_URL defaults to http://localhost:3000
 *   RECORD_DIR=/tmp/clip …                                         # also records a short video of the run
 */
const BASE = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const DEVICE = process.env.APP_E2E_DEVICE || "iPhone 17";

let webkit, devices;
try {
  ({ webkit, devices } = await import("playwright"));
} catch {
  console.error("✗ Playwright is missing: npm install, then npx playwright install webkit.");
  process.exit(2);
}

const home = await fetch(BASE).then((r) => (r.ok ? r.text() : null), () => null);
const watchId = home && /href="\/watch\/([0-9a-f-]{36})"/.exec(home)?.[1];
if (!watchId) {
  console.error(`✗ No watch page found at ${BASE}: seed the database or set APP_URL.`);
  process.exit(2);
}

const browser = await webkit.launch();
const context = await browser.newContext({ ...devices[DEVICE], ...(process.env.RECORD_DIR ? { recordVideo: { dir: process.env.RECORD_DIR, size: { width: 390, height: 844 } } } : {}) });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failures.push(what);
};

await page.goto(`${BASE}/watch/${watchId}`, { waitUntil: "networkidle" });
const gate = page.getByRole("button", { name: /I am 18/ });
if (await gate.count()) await gate.tap();
await page.locator("video").first().waitFor();
await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));

/** True when the element at the control's centre is the control (or inside it): nothing sits on top of it. */
const receivesTap = (name) =>
  page.getByRole("button", { name, exact: true }).evaluate((el) => {
    const b = el.getBoundingClientRect();
    const top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return Boolean(top && (top === el || el.contains(top)));
  });

for (const name of ["Play", "Mute", "Full screen"]) check(await receivesTap(name), `${name} receives the tap (nothing on top)`);
check(await page.getByRole("slider", { name: "Seek" }).evaluate((el) => {
  const b = el.getBoundingClientRect();
  const top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
  return Boolean(top && (top === el || el.contains(top) || top.contains(el)));
}), "Seek receives the tap");

await page.evaluate(() => {
  window.__fs = 0;
  document.querySelector("video").webkitEnterFullscreen = () => { window.__fs += 1; };
});
await page.getByRole("button", { name: "Full screen", exact: true }).tap();
check((await page.evaluate(() => window.__fs)) === 1, "Full screen calls video.webkitEnterFullscreen on iPhone");
check(errors.length === 0, `no page error${errors.length ? ` (${errors[0]})` : ""}`);

await page.getByRole("button", { name: "Play", exact: true }).tap();
await page.waitForFunction(() => !document.querySelector("video").paused, null, { timeout: 8000 }).catch(() => {});
check(await page.evaluate(() => !document.querySelector("video").paused), "Play starts the video");
check((await page.getByRole("button", { name: "Pause", exact: true }).count()) === 1, "the button turns into Pause");

await page.getByRole("button", { name: "Mute", exact: true }).tap();
check(await page.evaluate(() => document.querySelector("video").muted), "Mute mutes");
check((await page.getByRole("button", { name: "Unmute", exact: true }).count()) === 1, "the button turns into Unmute");

const slider = page.getByRole("slider", { name: "Seek" });
const box = await slider.boundingBox();
const seekRoot = page.locator("video").locator("xpath=..").locator('[role="slider"]').first();
await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
check(await page.evaluate(() => document.querySelector("video").currentTime > 0.5), "tapping the timeline seeks");

await page.getByRole("button", { name: "Pause", exact: true }).tap();
await page.waitForFunction(() => document.querySelector("video").paused, null, { timeout: 4000 }).catch(() => {});
check(await page.evaluate(() => document.querySelector("video").paused), "Pause pauses");
void seekRoot;

await context.close();
await browser.close();
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
