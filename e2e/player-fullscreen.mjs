#!/usr/bin/env node
/**
 * The player's fullscreen control on a phone: it must be the element a finger lands on (nothing sits over it), and a
 * tap must reach the platform's fullscreen — the container where the browser has it (Android), the video's own
 * `webkitEnterFullscreen` on iPhone, where a container cannot be fullscreened.
 *
 *   APP_URL=https://dev.orochia.com WATCH_PATH=/watch/<id> npm run test:e2e:player
 */
import { chromium, devices, webkit } from "playwright";

const B = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const WATCH = process.env.WATCH_PATH || "/watch/a7f32d84-e3b7-49e9-8e14-21c11781bdcf";
let failures = 0;
const check = (name, cond, extra = "") => { console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : "  " + extra}`); if (!cond) failures++; };

const profiles = [
  { name: "iPhone 15 (WebKit)", engine: webkit, device: devices["iPhone 15"], expect: "video" },
  { name: "Pixel 7 (Chromium)", engine: chromium, device: devices["Pixel 7"], expect: "container" },
];

for (const { name, engine, device, expect } of profiles) {
  const browser = await engine.launch();
  const page = await (await browser.newContext(device)).newPage();
  await page.addInitScript(() => {
    window.__fs = [];
    // Record which fullscreen API the tap reaches, without needing a user gesture to succeed.
    HTMLVideoElement.prototype.webkitEnterFullscreen = function () { window.__fs.push("video"); };
    if (Element.prototype.requestFullscreen) {
      Element.prototype.requestFullscreen = function () { window.__fs.push("container"); return Promise.resolve(); };
    }
  });
  await page.goto(B + WATCH, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /18 or older/ }).click({ timeout: 3000 }).catch(() => {});
  const button = page.getByRole("button", { name: /full ?screen/i }).first();
  await button.waitFor({ state: "attached", timeout: 15000 });
  await button.scrollIntoViewIfNeeded();
  const size = await button.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    return hit ? Math.min(r.width, r.height) : 0;
  });
  check(`${name}: the fullscreen control is what a finger lands on`, size > 0, "covered by another element");
  check(`${name}: …and big enough to tap (>= 44 px)`, size >= 44, `size ${size}`);
  await button.tap();
  const reached = await page.evaluate(() => window.__fs);
  check(`${name}: a tap reaches the ${expect} fullscreen`, reached.includes(expect), `reached ${JSON.stringify(reached)}`);
  await browser.close();
}
process.exit(failures ? 1 : 0);
