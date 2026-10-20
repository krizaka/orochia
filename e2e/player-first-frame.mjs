#!/usr/bin/env node
/**
 * Time to first frame of a watch page, and whether any « authoris… » sentence shows while it loads.
 *
 *   APP_URL=http://localhost:3100 node e2e/player-first-frame.mjs /watch/<id> [--runs 5] [--rtt 80] [--referer https://dev.orochia.com/] [--record <dir>] [--chrome]
 *
 * First frame = the first `loadeddata` of the page's <video>, in ms since navigation start (the same clock before and
 * after a change). `--rtt` adds that much latency to every request (a phone on 4G is ~80-150 ms), which is where a
 * client round-trip before play shows. Playwright's Chromium has no H.264: pass `--chrome` to use the installed Chrome. `--record <dir>` saves a video of one extra run on a desktop and a phone profile.
 */
import { chromium, devices } from "playwright";

const args = process.argv.slice(2);
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const B = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const WATCH = args.find((a) => a.startsWith("/watch/")) || "/watch/d0ade287-beea-4a42-af42-3b3541e85ac7";
const RUNS = Number(flag("--runs", 5));
const RTT = Number(flag("--rtt", 0));
const RECORD = flag("--record", "");
// Bunny's referrer list holds `localhost` without a port: a local run presents the dev site's address to the CDN instead.
const REFERER = flag("--referer", "");
// Or, better: `--map-host local.orochia.com` resolves that name to this machine, so APP_URL=http://local.orochia.com:3100 is a host Bunny allows (*.orochia.com).
const MAP_HOST = flag("--map-host", "");

async function once(profile, record) {
  const browser = await chromium.launch({ channel: args.includes("--chrome") ? "chrome" : undefined, args: MAP_HOST ? [`--host-resolver-rules=MAP ${MAP_HOST} 127.0.0.1`] : [] });
  const context = await browser.newContext({
    ...(profile === "phone" ? devices["Pixel 7"] : { viewport: { width: 1280, height: 800 } }),
    ...(record ? { recordVideo: { dir: record, size: profile === "phone" ? { width: 412, height: 915 } : { width: 1280, height: 800 } } } : {}),
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__ff = null;
    window.__text = false;
    document.addEventListener("loadeddata", () => { window.__ff ??= Math.round(performance.now()); }, true);
    new MutationObserver(() => {
      if (/authori[sz]|checking (your )?access|checking you/i.test(document.body?.innerText ?? "")) window.__text = true;
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });
  if (RTT) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: RTT, downloadThroughput: (6 * 1024 * 1024) / 8, uploadThroughput: (2 * 1024 * 1024) / 8 });
  }
  if (REFERER) await page.route(/b-cdn\.net/, (route) => route.continue({ headers: { ...route.request().headers(), referer: REFERER } }));
  await page.goto(B + WATCH, { waitUntil: "commit" });
  await page.waitForFunction(() => window.__ff !== null, null, { timeout: 30000 });
  const out = await page.evaluate(() => ({ ff: window.__ff, sentence: window.__text }));
  if (record) {
    await page.getByRole("button", { name: /18 or older/ }).click({ timeout: 3000 }).catch(() => {});
    // Let the person see it play: tap play like a viewer would, a few seconds.
    await page.getByRole("button", { name: /^play$/i }).first().click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(3500);
    out.watermark = await page.locator('[data-testid="player-watermark"]').count();
  }
  await context.close();
  await browser.close();
  return out;
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
for (const profile of ["desktop", "phone"]) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await once(profile, null));
  const ff = runs.map((r) => r.ff);
  console.log(`${profile}: first frame median ${median(ff)} ms (runs ${ff.join(", ")}) rtt=${RTT}ms · loading sentence seen: ${runs.some((r) => r.sentence)}`);
  if (RECORD) {
    const r = await once(profile, `${RECORD}/${profile}`);
    console.log(`${profile}: recorded to ${RECORD}/${profile} (watermark elements: ${r.watermark})`);
  }
}
