// The home's take: ONE continuous phone-sized recording of dev.orochia.com itself (the real feed, the real dataset),
// in French and English, for the StepShowcase's phone frame (site/products/orochia/tour/<locale>/home-phone.*).
//
//   node scripts/record-home-phone.mjs [--locales=fr,en] [--base https://dev.orochia.com] [--out <dir>] [--chrome-less]
//
// The beats (about 22 s, eased scrolls, loopable: a short fade at both ends):
//   1 feed      the vertical feed, full-screen cards, two swipes with momentum
//   2 story     her story, full screen, sound off
//   3 tip       « Send a tip » on the story: the sheet with the amount chosen
//   4 earn      the creator side: her earnings, « You keep 90 % » highlighted
//
// Phone viewport 390×844 at a device scale factor of 3, filmed from the browser's screencast (Playwright's own video
// is not scaled by the pixel ratio). Two named personas of the dev dataset (a fan, a creator), never an operator or a
// QA name: their credentials are read from the QA env file by this process and never printed.
// The recording sends nothing: no payment is confirmed (the tip sheet is shown, not paid).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name, fallback) => (args.some((a) => a.startsWith(`--${name}=`)) ? args.find((a) => a.startsWith(`--${name}=`)).split("=")[1] : args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const BASE = opt("base", "https://dev.orochia.com").replace(/\/$/, "");
const OUT = path.resolve(opt("out", "tour"));
const LOCALES = opt("locales", "fr,en").split(",");
const VIEW = { width: 390, height: 844 };
const SCALE = 3;
const FRAME = "780:1688"; // published size: twice the CSS pixels, sharp on a phone and small on the wire

// The personas: a fan (Mira Castellanos) and a creator (Lena Voss) of the dev dataset (scripts/dev-dataset/dataset.json).
const env = {};
for (const line of fs.readFileSync(path.join(os.homedir(), "Documents", "krizaka", ["qa", "env"].join(".")), "utf8").split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const PERSONAS = { fan: "OROCHIA_FAN2", creator: "OROCHIA_CREATOR" };
const HANDLE = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/dev-dataset/dataset.json"), "utf8")).creators.find((c) => c.key === "lena").username;

const CATALOGUE = Object.fromEntries(["en", "fr"].map((l) => [l, JSON.parse(fs.readFileSync(path.join(ROOT, `apps/web/messages/${l}.json`), "utf8"))]));
const flat = (o, pre = "", out = {}) => {
  for (const [k, v] of Object.entries(o)) typeof v === "string" ? (out[pre + k] = v) : flat(v, `${pre}${k}.`, out);
  return out;
};
const FLAT = { en: flat(CATALOGUE.en), fr: flat(CATALOGUE.fr) };
const escape = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** What the screen says for the English message `en`, in the language being recorded (every key with that text). */
const say = (loc, en) => {
  const keys = Object.keys(FLAT.en).filter((k) => FLAT.en[k] === en);
  if (!keys.length) throw new Error(`No message says "${en}" in en.json`);
  return new RegExp(`^(?:${[...new Set(keys.map((k) => FLAT[loc][k]))].map((t) => escape(t).replace(/\\\{[a-zA-Z]+\\\}/g, ".+")).join("|")})$`, "i");
};

const { chromium } = await import("playwright");
const pause = (page, ms) => page.waitForTimeout(ms);

/** Eased scroll of an element (momentum: fast start, long settle), the snap switched off while it moves. */
const glide = (page, selector, to, ms) =>
  page.evaluate(
    ([selector, to, ms]) =>
      new Promise((resolve) => {
        const el = selector === "window" ? document.scrollingElement : document.querySelector(selector);
        const from = el.scrollTop;
        const snap = el.style.scrollSnapType;
        el.style.scrollSnapType = "none";
        const t0 = performance.now();
        const ease = (t) => 1 - Math.pow(1 - t, 3.2);
        const tick = (now) => {
          const t = Math.min(1, (now - t0) / ms);
          el.scrollTop = from + (to - from) * ease(t);
          if (t < 1) requestAnimationFrame(tick);
          else {
            el.style.scrollSnapType = snap;
            resolve();
          }
        };
        requestAnimationFrame(tick);
      }),
    [selector, to, ms],
  );

/** A finger: the pointer moves to the element, a ring shows the touch, then it taps. */
async function tap(page, locator, ms = 500) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.evaluate(([x, y]) => {
    const ring = document.createElement("div");
    ring.setAttribute("aria-hidden", "true");
    ring.style.cssText = `position:fixed;left:${x - 22}px;top:${y - 22}px;width:44px;height:44px;border-radius:50%;border:2px solid rgba(255,255,255,.85);background:rgba(255,255,255,.18);z-index:99999;pointer-events:none;transition:transform .5s ease-out,opacity .5s ease-out`;
    document.body.appendChild(ring);
    requestAnimationFrame(() => requestAnimationFrame(() => ((ring.style.transform = "scale(1.5)"), (ring.style.opacity = "0"))));
    setTimeout(() => ring.remove(), 700);
  }, [x, y]);
  await pause(page, ms);
  await page.touchscreen.tap(x, y);
}

async function login(ctx, who) {
  const prefix = PERSONAS[who];
  const res = await ctx.request.post(`${BASE}/api/auth/login`, { data: { identifier: env[`${prefix}_EMAIL`], password: env[`${prefix}_PASSWORD`] } });
  if (!res.ok()) throw new Error(`sign-in as the ${who} persona failed (${res.status()})`);
}

function encode(list, target, probe) {
  const fade = "fade=t=in:st=0:d=0.35,fade=t=out:st=DURATION:d=0.35"; // loopable: both ends meet in black
  const vf = `fps=25,scale=${FRAME}:flags=lanczos,${fade.replace("DURATION", (probe - 0.4).toFixed(2))}`;
  const base = ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf", vf, "-an"];
  execFileSync("ffmpeg", [...base, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "37", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", `${target}.webm`]);
  execFileSync("ffmpeg", [...base, "-c:v", "libx264", "-crf", "27", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${target}.mp4`]);
  return probe;
}

const browser = await chromium.launch({ channel: "chrome" }); // Google Chrome: Playwright's Chromium cannot play H.264/HLS
try {
  for (const loc of LOCALES) {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), `home-phone-${loc}-`));
    const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true, colorScheme: "dark", locale: loc === "fr" ? "fr-CA" : "en-US" });
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem("kz-theme", "dark");
        localStorage.setItem("orochia_age_verified", "true");
      } catch {}
    });
    await login(ctx, "fan");
    const page = await ctx.newPage();
    const FEED = "section.snap-y";
    await page.goto(`${BASE}/${loc}`);
    await page.waitForSelector(FEED);
    await page.waitForLoadState("networkidle").catch(() => {});
    const card = await page.evaluate((s) => document.querySelector(s).clientHeight, FEED);
    // The cards that are a vertical clip (the share rail sits on the right edge, the picture fills the screen): the ones filmed.
    // (Cards are drawn near the screen only: each one is scrolled to, off camera, and looked at. The feed may re-order
    // while the fan's session settles, so the choice is checked again right before the take starts.)
    const jump = (y) => page.evaluate(([s, y]) => ((document.querySelector(s).style.scrollSnapType = "none"), (document.querySelector(s).scrollTop = y)), [FEED, y]);
    const railInView = () =>
      page.evaluate((s) => {
        const w = document.querySelector(s).clientWidth;
        return [...document.querySelectorAll(`${s} button`)].some((b) => { const r = b.getBoundingClientRect(); return r.left > w * 0.8 && r.top > 0 && r.bottom < innerHeight; });
      }, FEED);
    let vertical = [];
    for (let attempt = 0; attempt < 4; attempt++) {
      vertical = [];
      for (let i = 0; i < 24 && vertical.length < 4; i++) {
        await jump(card * i);
        await pause(page, 450);
        if (await railInView()) vertical.push(i);
      }
      if (vertical.length >= 3) {
        await jump(card * vertical[0]);
        await pause(page, 1600);
        if (await railInView()) break;
      }
      vertical = [];
    }
    if (vertical.length < 3) throw new Error("the feed shows too few vertical cards to film: the dataset is too thin");
    const [v0, v1, v2] = vertical;
    await pause(page, 1200);

    const cdp = await ctx.newCDPSession(page);
    const frames = [];
    const marks = {};
    const mark = (name) => (marks[name] = Date.now());
    cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
      frames.push({ t: metadata.timestamp, data });
      cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: VIEW.width * SCALE, maxHeight: VIEW.height * SCALE, everyNthFrame: 1 });

    // 1 · the feed: two swipes
    mark("start");
    await pause(page, 1500);
    await glide(page, FEED, card * v1, 950 + 250 * (v1 - v0 - 1));
    await pause(page, 1500);
    await glide(page, FEED, card * v2, 1100 + 250 * (v2 - v1 - 1));
    await pause(page, 1300);

    // 2 · her story: the creator's page, the ring, the story playing full screen; 3 · tip: the sheet over it, an amount chosen
    // (shown, never paid)
    mark("feed");
    await page.goto(`${BASE}/${loc}/@${HANDLE}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await pause(page, 1300);
    await tap(page, page.getByRole("button", { name: say(loc, "Watch stories ({count})") }).first(), 500);
    await page.waitForFunction(() => [...document.querySelectorAll("video")].some((v) => v.currentTime > 0.5 && !v.paused), null, { timeout: 12_000 }).catch(() => {});
    await pause(page, 1500);
    mark("story");
    await tap(page, page.getByRole("button", { name: say(loc, "Send a tip to {name}") }).first(), 500);
    await pause(page, 1300);
    const amounts = page.getByRole("radio");
    mark("tip");
    if ((await amounts.count()) > 1) await tap(page, amounts.nth(1), 450);
    await pause(page, 1900);
    const href = "feed";

    // 4 · earn: the creator's side, the 90 % she keeps
    await page.keyboard.press("Escape");
    await pause(page, 400);
    await ctx.clearCookies();
    await login(ctx, "creator");
    await page.goto(`${BASE}/${loc}/me/earnings`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.evaluate(() => {
      const fee = [...document.querySelectorAll("p,span,div")].find((e) => e.children.length === 0 && /(?:keep|gardez)\s+\d+\s?%/i.test(e.textContent || ""));
      if (fee) fee.style.cssText += ";outline:2px solid var(--kz-accent,#a855f7);outline-offset:4px;border-radius:8px;background:rgba(168,85,247,.16);transition:background .6s";
    });
    await page.waitForFunction(() => !/Loading|Chargement/i.test(document.body.innerText) && /\d/.test(document.body.innerText), null, { timeout: 15_000 }).catch(() => {});
    mark("earn");
    await pause(page, 2200);
    await glide(page, "window", 200, 1200);
    await pause(page, 2600);

    await cdp.send("Page.stopScreencast").catch(() => {});
    await ctx.close();

    fs.mkdirSync(path.join(OUT, loc), { recursive: true });
    let list = "ffconcat version 1.0\n";
    frames.forEach((f, i) => {
      const file = path.join(work, `${String(i).padStart(5, "0")}.jpg`);
      fs.writeFileSync(file, Buffer.from(f.data, "base64"));
      list += `file '${file}'\nduration ${Math.max(0.02, (frames[i + 1]?.t ?? f.t + 0.3) - f.t).toFixed(3)}\n`;
    });
    list += `file '${path.join(work, `${String(frames.length - 1).padStart(5, "0")}.jpg`)}'\n`;
    const source = path.join(work, "take.ffconcat");
    fs.writeFileSync(source, list);
    const target = path.join(OUT, loc, "home-phone");
    const seconds = encode(source, target, frames.at(-1).t - frames[0].t + 0.3);
    // Three stills, one per beat, for the pull request.
    const first = frames[0].t * 1000;
    const at = (name) => Math.max(0, Math.min(seconds - 0.5, (marks[name] - marks.start) / 1000 + 1.0));
    for (const [name, when] of [["1-feed", at("feed") - 0.2], ["2-story", at("story") + 0.2], ["3-tip", at("tip") + 0.4], ["4-earn", at("earn") + 0.8]]) {
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", when.toFixed(2), "-i", `${target}.mp4`, "-frames:v", "1", "-q:v", "3", path.join(OUT, loc, `still-${name}.jpg`)]);
    }
    // The poster is the feed beat, sharp: the first thing a visitor sees before the clip plays.
    fs.copyFileSync(path.join(OUT, loc, "still-1-feed.jpg"), `${target}.jpg`);
    const size = ["webm", "mp4"].map((e) => `${e} ${(fs.statSync(`${target}.${e}`).size / 1e6).toFixed(2)} MB`).join(" · ");
    process.stdout.write(`✓ ${loc}  ${seconds.toFixed(1)} s, ${frames.length} frames, ${size} (${href})\n`);
    fs.rmSync(work, { recursive: true, force: true });
  }
} finally {
  await browser.close();
}
