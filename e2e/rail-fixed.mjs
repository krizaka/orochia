#!/usr/bin/env node
/**
 * The rail stays where it is while the page scrolls (desktop): after scrolling 2000 px its bounding box is unchanged and
 * its last item (Create) is still in view. Regression of 2026-10-20: `overflow-x: hidden` on html/body made them scroll
 * containers and took the sticky rail away with the page.
 *
 *   APP_URL=http://localhost:3000 node e2e/rail-fixed.mjs
 */
const BASE = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE, { waitUntil: "load" });
for (const name of ["I am 18 or older", "Enter"]) {
  try {
    await page.getByRole("button", { name }).first().click({ timeout: 800 });
    break;
  } catch {
    /* no age gate */
  }
}
await page.waitForTimeout(1500);
const rail = page.locator("nav:has([data-rail-item])").first();
const lastItem = page.locator("nav:has([data-rail-item]) a").last();
const before = await rail.boundingBox();
await page.mouse.wheel(0, 2000);
await page.waitForTimeout(600);
const after = await rail.boundingBox();
const foot = await lastItem.boundingBox();
const scrolled = await page.evaluate(() => window.scrollY);
await browser.close();

const ok =
  scrolled > 0 &&
  before &&
  after &&
  Math.abs(before.y - after.y) < 1 &&
  Math.abs(before.height - after.height) < 1 &&
  foot &&
  foot.y >= 0 &&
  foot.y + foot.height <= 900;
console.log(
  ok
    ? `✓ the rail did not move (scrolled ${scrolled}px)`
    : `✗ the rail moved: before ${JSON.stringify(before)}, after ${JSON.stringify(after)}, last item ${JSON.stringify(foot)}, scrolled ${scrolled}`,
);
process.exit(ok ? 0 : 1);
