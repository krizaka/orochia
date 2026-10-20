#!/usr/bin/env node
/**
 * The watch page's player (orochia#349): the AI chip, the Orochia mark clear of the controls, and the quality picker
 * that really switches the rendition (`videoHeight` changes), on desktop and phone × dark and light × EN and FR.
 *
 *   APP_URL=https://dev.orochia.com node e2e/player-quality.mjs [/watch/<id>] [--out <dir>] [--record] [--ai] [--only desktop|phone]
 *
 * `--ai` expects the AI chip (the reference film carries a stored provenance). Playwright's Chromium has no H.264:
 * the installed Chrome plays the stream. Screenshots (and with `--record` a video per profile) go to `--out`.
 */
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const args = process.argv.slice(2);
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const B = (process.env.APP_URL || "https://dev.orochia.com").replace(/\/$/, "");
const WATCH = args.find((a) => a.startsWith("/watch/")) || "/watch/53739e82-1929-4f43-a051-71341897b34c";
const OUT = flag("--out", "");
const RECORD = args.includes("--record");
const EXPECT_AI = args.includes("--ai");
const ONLY = flag("--only", "");
let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `  ${extra}`}`);
  if (!ok) failures++;
};
if (OUT) mkdirSync(OUT, { recursive: true });

const profiles = [
  { name: "desktop", device: { viewport: { width: 1280, height: 800 } }, record: { width: 1280, height: 800 } },
  { name: "phone", device: devices["Pixel 7"], record: { width: 412, height: 915 } },
].filter((p) => !ONLY || p.name === ONLY);

const intersects = (a, b) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const ageGate = /18 ans|18 or older|18 ans ou plus/;

async function run(profile, theme, locale) {
  const tag = `${profile.name}-${theme}-${locale}`;
  const browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext({
    ...profile.device,
    colorScheme: theme,
    ...(RECORD && theme === "dark" && locale === "en" && OUT ? { recordVideo: { dir: OUT, size: profile.record } } : {}),
  });
  await context.addInitScript((t) => {
    try {
      localStorage.setItem("kz-theme", t);
    } catch {
      /* storage blocked */
    }
  }, theme);
  const page = await context.newPage();
  await page.goto(`${B}${locale === "fr" ? "/fr" : ""}${WATCH}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: ageGate }).click({ timeout: 8000 }).catch(() => {});
  const video = page.getByTestId("player-video");
  await video.waitFor({ timeout: 30000 });
  await page.evaluate(() => document.querySelector("video")?.scrollIntoView({ block: "center" }));
  await video.click({ position: { x: 40, y: 80 } });
  await page.waitForFunction(() => { const v = document.querySelector("video"); return v && v.readyState >= 3 && v.currentTime > 1; }, null, { timeout: 45000 });
  console.log(`\n== ${tag}`);

  // The chip: the interface's language, an accessible name, visible at the start, 8 px.
  const chip = page.getByTestId("player-ai-chip");
  if (EXPECT_AI) {
    await chip.waitFor({ timeout: 10000 });
    const text = (await chip.innerText()).trim();
    check(`${tag}: AI chip says « ${text} » in ${locale}`, text === (locale === "fr" ? "Généré par IA" : "AI-generated"), text);
    check(`${tag}: AI chip has an accessible name`, !!(await chip.getAttribute("aria-label")));
    check(`${tag}: AI chip is visible at the start`, Number(await chip.evaluate((el) => getComputedStyle(el).opacity)) > 0.9);
    const radius = await chip.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    check(`${tag}: AI chip is 8 px`, radius === "8px", radius);
  }

  // The controls: shown by a hover on a mouse (always on touch), the quality button, the full-screen button.
  await video.hover({ position: { x: 100, y: 100 } }).catch(() => {});
  const menuButton = page.getByRole("button", { name: locale === "fr" ? /Qualité/ : /Quality/ });
  await menuButton.waitFor({ timeout: 20000 });
  const fsButton = page.getByRole("button", { name: locale === "fr" ? /plein écran/i : /full ?screen/i }).first();
  const frame = await video.evaluate((el) => { const r = el.parentElement.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  const boxes = {
    menu: await menuButton.boundingBox(),
    fs: await fsButton.boundingBox(),
    chip: EXPECT_AI ? await chip.boundingBox() : null,
    mark: await page.getByTestId("player-watermark").boundingBox({ timeout: 1500 }).catch(() => null),
  };
  check(`${tag}: quality button and full-screen button do not overlap`, !intersects(boxes.menu, boxes.fs));
  if (EXPECT_AI) check(`${tag}: the chip sits in the top-right of the player`, boxes.chip.x > frame.x + frame.width / 2 && boxes.chip.y < frame.y + frame.height / 3);
  if (boxes.mark) check(`${tag}: the player's own mark is top-left, clear of the controls`, boxes.mark.x < frame.x + frame.width / 4 && boxes.mark.y < frame.y + frame.height / 4 && !intersects(boxes.mark, boxes.menu) && !intersects(boxes.mark, boxes.fs));
  if (OUT) await page.screenshot({ path: `${OUT}/${tag}-1-playing.png` });

  // The picker: open, list, badges, keyboard, switch, measure.
  await menuButton.click();
  const menu = page.getByRole("menu");
  await menu.waitFor({ timeout: 5000 });
  const items = await menu.getByRole("menuitemradio").evaluateAll((els) => els.map((e) => ({ id: e.getAttribute("data-quality"), text: e.textContent.trim(), checked: e.getAttribute("aria-checked") })));
  console.log("   menu:", items.map((i) => `${i.text}${i.checked === "true" ? "*" : ""}`).join(" | "));
  check(`${tag}: Auto first, then the renditions best to worst`, items[0]?.id === "auto" && items.slice(1).every((it, i, a) => i === 0 || Number(a[i - 1].id) > Number(it.id)));
  const badged = await menu.getByTestId("quality-badge").evaluateAll((els) => els.map((e) => e.parentElement.getAttribute("data-quality")));
  check(`${tag}: badges only on 1080 and above`, badged.every((id) => Number(id) >= 1080), badged.join(","));
  check(`${tag}: Auto is the checked item at first`, items[0]?.checked === "true");
  if (OUT) await page.screenshot({ path: `${OUT}/${tag}-2-menu.png` });

  await page.keyboard.press("ArrowDown");
  const focusedId = await page.evaluate(() => document.activeElement?.getAttribute("data-quality"));
  check(`${tag}: ArrowDown moves the focus along the menu`, focusedId === items[1]?.id, String(focusedId));
  await page.keyboard.press("Escape");
  await menu.waitFor({ state: "detached", timeout: 3000 });
  check(`${tag}: Escape closes the menu and gives the focus back to its button`, await menuButton.evaluate((el) => el === document.activeElement));

  // Switch to the lowest rendition, then back to the top one: the picture's size follows.
  const shortSide = () => page.evaluate(() => { const v = document.querySelector("video"); return Math.min(v.videoWidth, v.videoHeight); });
  const pick = async (id) => {
    await menuButton.click();
    await page.locator(`[role="menuitemradio"][data-quality="${id}"]`).click();
  };
  const renditions = items.filter((i) => i.id !== "auto");
  const lowest = renditions[renditions.length - 1];
  const highest = renditions[0];
  if (renditions.length > 1) {
    await pick(lowest.id);
    await page.waitForFunction((h) => { const v = document.querySelector("video"); return Math.min(v.videoWidth, v.videoHeight) === h && v.currentTime > 0; }, Number(lowest.id), { timeout: 30000 }).catch(() => {});
    const low = await shortSide();
    check(`${tag}: choosing ${lowest.id}p switches the picture (videoHeight ${low})`, low === Number(lowest.id), String(low));
    check(`${tag}: the button names the choice`, (await menuButton.getAttribute("aria-label")).includes(`${lowest.id}p`));
    await page.waitForTimeout(1200);
    if (OUT) await page.screenshot({ path: `${OUT}/${tag}-3-low.png` });
    await pick(highest.id);
    await page.waitForFunction((h) => { const v = document.querySelector("video"); return Math.min(v.videoWidth, v.videoHeight) === h; }, Number(highest.id), { timeout: 30000 }).catch(() => {});
    const high = await shortSide();
    check(`${tag}: choosing ${highest.id}p switches back (videoHeight ${high})`, high === Number(highest.id), String(high));
    // The choice is the session's: a reload keeps it.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: ageGate }).click({ timeout: 4000 }).catch(() => {});
    await menuButton.waitFor({ timeout: 30000 }).catch(() => {});
    check(`${tag}: the choice is remembered for the session`, (await page.evaluate(() => sessionStorage.getItem("kz-orochia-quality"))) === highest.id);
  } else {
    check(`${tag}: a single rendition (nothing to switch)`, true);
  }
  await context.close();
  await browser.close();
}

for (const profile of profiles) {
  for (const theme of ["dark", "light"]) {
    for (const locale of ["en", "fr"]) {
      await run(profile, theme, locale).catch((e) => {
        console.log(`✗ ${profile.name}-${theme}-${locale}: ${e.message.split("\n")[0]}`);
        failures++;
      });
    }
  }
}
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
