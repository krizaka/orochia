// Product tour of the real application, recorded for krizaka.com (public/assets/orochia/tour/<clip>.{webm,mp4,jpg}).
//
//   npm run demo:seed                      # the official demo, in its own database (scripts/demo.mjs, cast.json)
//   npm run build && npm run demo:start    # a production build on that database, on :3100 (no dev overlay)
//   npm run record:tour                    # every clip; `-- alex-story elena-earnings` re-records some.
//                                          # APP_URL, OUT (tour/). Re-run demo:seed before a new full take:
//                                          # the clips pay, bid and back for real.
//
// Two people you can picture yourself as, never the operator: Elena Marlow, a singer-songwriter who films her songs
// (the creator), and Alex Carter, who plays them on repeat (the fan). The clips, in the order of their day:
//   alex-discover   Explore: the stories of the day, a search, Elena's music video playing
//   alex-story      Elena's story with the sound on, a like, a $5 tip
//   alex-unlock     Elena's acoustic session, unlocked for $8 in credits, playing at once
//   alex-bid        the director's cut auction: Alex bids and takes the lead
//   alex-back       Elena's goal at 60 %: Alex backs it with $25
//   elena-publish   a new video: the file, a title, "Paid unlock" at $6 (what she keeps is shown), published
//   elena-live      her dashboard while a tip and a bid arrive, live
//   elena-story     who watched, liked and tipped her story
//   elena-earnings  90 % of every payment, from the ledger; a withdrawal to her bank
//   showcase        25 s for the krizaka.com home card, cut from the clips above (run last)
//
// Every screen is filmed once its data and pictures are there (no spinner, no empty frame), in a smaller window
// (1120×700) so the interface reads larger once encoded to 1280×800 at 25 fps: VP9 .webm, H.264 .mp4 (faststart)
// and a .jpg poster. Sign-in happens outside the recording.
//
// Video delivery: when the Bunny CDN of the environment does not serve (TOUR_LOCAL_MEDIA=1, the default), the
// browser's requests to it are answered with the showcase clip the demo gave that video or story
// (apps/web/public/showcase, Mixkit licence, apps/web/public/CREDITS.md) packaged as HLS by ffmpeg — the access check,
// the signed URL and the player are the app's own; only the bytes come from this machine. The upload of
// elena-publish goes to Bunny for real.
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOWCASE = path.join(ROOT, "apps/web/public/showcase");
const CAST = JSON.parse(readFileSync(path.join(ROOT, "scripts/demo/cast.json"), "utf8"));
const BASE = (process.env.APP_URL || "http://localhost:3100").replace(/\/$/, "");
const OUT = path.resolve(process.env.OUT || "tour");
const LOCAL_MEDIA = process.env.TOUR_LOCAL_MEDIA !== "0";
const ONLY = process.argv.slice(2);
const WINDOW = { width: 1120, height: 700 };

const person = (key) => CAST.people.find((p) => p.key === key);
const video = (key) => CAST.videos.find((v) => v.key === key);
/** Bunny id → the showcase clip that plays it. */
const CLIP_OF = new Map([...CAST.videos, ...CAST.stories].map((m) => [m.bunnyId, m.clip]));
const STORY = CAST.stories.find((s) => s.creator === "elena");
const UPLOAD = { clip: "feed-2", title: "Neon Rain — behind the scenes" };

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("✗ Playwright is missing: npm install (it is a dev dependency), then npx playwright install chromium.");
  process.exit(2);
}
if (!(await fetch(BASE).then((r) => r.ok, () => false))) {
  console.error(`✗ Nothing answers at ${BASE}: npm run demo:seed, npm run build, npm run demo:start (or set APP_URL).`);
  process.exit(2);
}

/** An API session as one of the cast. */
async function api(key) {
  const res = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: person(key).email, password: CAST.password }) });
  if (!res.ok) throw new Error(`Sign-in as ${person(key).email} failed (${res.status}): npm run demo:seed first.`);
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const call = async (method, url, body) => {
    const r = await fetch(BASE + url, { method, headers: { cookie, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${key}: ${method} ${url} → ${r.status} ${JSON.stringify(json)}`);
    return json;
  };
  return { cookie, call };
}

/** The app's id of a demo video, from its creator's page (the creator sees all of theirs). */
async function videoId(session, key) {
  const v = video(key);
  const html = await fetch(`${BASE}/@${person(v.creator).username}`, { headers: { cookie: session.cookie } }).then((r) => r.text());
  for (const id of new Set([...html.matchAll(/\/watch\/([0-9a-f-]{36})/g)].map((m) => m[1]))) {
    const details = await session.call("GET", `/api/videos/${id}/details`).catch(() => null);
    if (details?.video?.title === v.title) return id;
  }
  throw new Error(`"${v.title}" is not on its creator's page: npm run demo:seed first.`);
}

/** Every showcase clip the demo uses, packaged as HLS once (see the top of this file). */
async function localMedia(raw) {
  const dir = path.join(raw, "hls");
  for (const clip of new Set([...CLIP_OF.values()])) {
    await mkdir(path.join(dir, clip), { recursive: true });
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-stream_loop", "4", "-i", path.join(SHOWCASE, `${clip}.mp4`),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-g", "50", "-an", "-f", "hls", "-hls_time", "2", "-hls_playlist_type", "vod",
      "-hls_segment_filename", path.join(dir, clip, "seg%03d.ts"), path.join(dir, clip, "playlist.m3u8")]);
  }
  return dir;
}

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });
const raw = await mkdtemp(path.join(os.tmpdir(), "orochia-tour-"));
const pause = (page, ms) => page.waitForTimeout(ms);
const sessions = new Map();
let hls = null;

/** A browser context in dark English, signed in as `who`, recording when asked. */
async function context(who, record) {
  const ctx = await browser.newContext({ viewport: WINDOW, colorScheme: "dark", storageState: sessions.get(who), recordVideo: record ? { dir: raw, size: WINDOW } : undefined });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("kz-theme", "dark");
      localStorage.setItem("orochia_age_verified", "true");
    } catch {}
  });
  if (!sessions.has(who)) {
    // Once per person and run: sign-in is rate-limited.
    const res = await ctx.request.post(`${BASE}/api/auth/login`, { data: { identifier: person(who).email, password: CAST.password } });
    if (!res.ok()) throw new Error(`Sign-in as ${person(who).email} failed (${res.status()})`);
    sessions.set(who, { cookies: (await ctx.storageState()).cookies, origins: [] });
  }
  if (hls) {
    await ctx.route(/\.b-cdn\.net\//, async (route) => {
      const url = route.request().url().split("?")[0];
      const id = url.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?.[0];
      const clip = id && CLIP_OF.get(id);
      const name = url.split("/").pop();
      if (!clip) return route.fulfill({ status: 404 });
      const poster = /\.(jpe?g|webp|png)$/.test(name);
      const file = poster ? path.join(SHOWCASE, `${clip}.jpg`) : path.join(hls, clip, name);
      if (!existsSync(file)) return route.fulfill({ status: 404 });
      const contentType = poster ? "image/jpeg" : name.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t";
      await route.fulfill({ status: 200, contentType, body: await readFile(file), headers: { "access-control-allow-origin": "*" } });
    });
  }
  return ctx;
}

/** Waits until the page has its data, its pictures decoded and its videos playing: nothing loads on camera. */
async function settled(page, ms = 800) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page
    .waitForFunction(
      () =>
        [...document.images].filter((i) => i.getBoundingClientRect().top < innerHeight).every((i) => i.complete) &&
        [...document.querySelectorAll("video")].every((v) => v.readyState >= 2 || v.paused) &&
        !document.querySelector('[aria-busy="true"], .animate-pulse'),
      null,
      { timeout: 8000 },
    )
    .catch(() => {});
  await pause(page, ms);
}

/** Scrolls the page smoothly by `dy` pixels. */
async function glide(page, dy, ms = 1400) {
  await page.evaluate((dy) => window.scrollBy({ top: dy, behavior: "smooth" }), dy);
  await pause(page, ms);
}

/** Moves the pointer onto an element, then clicks it — a viewer can follow the gesture. */
async function press(page, locator, ms = 450) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 14 });
  await pause(page, ms);
  await locator.click();
}

/** Types like a person. */
async function type(page, locator, text, delay = 55) {
  await press(page, locator, 250);
  await locator.pressSequentially(text, { delay });
}

const elena = person("elena");

/** Each clip: who plays it, then a function that opens the page and returns what to film once it has settled. */
const CLIPS = {
  "alex-discover": {
    who: "alex",
    poster: 0.9, // her music video, playing
    async open(page) {
      await page.goto(`${BASE}/explore`);
      return async () => {
        await pause(page, 1400);
        await glide(page, 560, 1700); // trending, then the stories of the day
        await glide(page, 360, 1600);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
        await pause(page, 900);
        const box = page.getByPlaceholder(/Search videos, creators, stories/);
        await type(page, box, "rain", 110);
        await page.keyboard.press("Enter");
        await settled(page, 1400);
        await glide(page, 380, 1600);
        await press(page, page.getByRole("link", { name: new RegExp(video("neonRain").title) }).first());
        await page.waitForURL(/\/watch\//);
        await settled(page, 3600);
      };
    },
  },

  "alex-story": {
    who: "alex",
    poster: 0.35,
    async open(page) {
      await page.goto(`${BASE}/@${elena.username}`);
      return async () => {
        await pause(page, 1200);
        await press(page, page.getByRole("button", { name: /Watch stories/ }), 600);
        await settled(page, 900);
        const sound = page.getByRole("button", { name: /Tap for sound|Turn sound on/ }).first();
        if (await sound.isVisible().catch(() => false)) await press(page, sound, 300);
        await pause(page, 1600);
        await press(page, page.getByRole("button", { name: /^Like$/ }).last(), 300);
        await pause(page, 900);
        await press(page, page.getByRole("button", { name: new RegExp(`Send a tip to ${elena.displayName}`) }), 300);
        await pause(page, 1300);
        await press(page, page.getByRole("button", { name: /^Pay \$/ }));
        await pause(page, 3200);
      };
    },
  },

  "alex-unlock": {
    who: "alex",
    async open(page, ids) {
      await page.goto(`${BASE}/watch/${ids.acoustic}`);
      return async () => {
        await pause(page, 1800);
        await press(page, page.getByRole("button", { name: /Unlock for/ }).first());
        await pause(page, 1400);
        await press(page, page.getByRole("button", { name: /^Pay \$/ }));
        await pause(page, 2400);
        const play = page.getByRole("button", { name: /^Play/ }).first();
        if (await play.isVisible().catch(() => false)) await press(page, play);
        await pause(page, 5200);
      };
    },
  },

  "alex-bid": {
    who: "alex",
    async open(page) {
      await page.goto(`${BASE}/auctions`);
      return async () => {
        await pause(page, 2600);
        await press(page, page.getByText(video(CAST.auction.video).title).first());
        await page.waitForURL(/#auction/);
        await settled(page, 2800);
        await press(page, page.getByRole("radio").nth(1)); // the second suggested amount
        await pause(page, 700);
        await press(page, page.getByRole("button", { name: /Place bid/ }));
        await pause(page, 3000);
        await glide(page, 260, 1600); // the bids: "You" in the lead, the others as aliases
        await pause(page, 1600);
      };
    },
  },

  "alex-back": {
    who: "alex",
    async open(page) {
      await page.goto(`${BASE}/challenges`);
      return async () => {
        await pause(page, 2600);
        await press(page, page.getByText(CAST.goal.title).first());
        await page.waitForURL(/\/challenges\/[0-9a-f-]{36}/);
        await settled(page, 2800);
        await press(page, page.getByRole("radio", { name: /\$25\.00/ }).or(page.getByRole("button", { name: /^\$25\.00$/ })).first());
        await pause(page, 600);
        await press(page, page.getByRole("button", { name: /^Pledge/ }));
        await pause(page, 3000);
        await glide(page, 240, 1600); // the latest pledges, "You" first
        await pause(page, 1600);
      };
    },
  },

  "elena-publish": {
    who: "elena",
    poster: 0.55,
    async open(page) {
      await page.goto(`${BASE}/creator/upload`);
      return async () => {
        await pause(page, 1200);
        const chooser = page.waitForEvent("filechooser");
        await press(page, page.getByText("choose a file"));
        await (await chooser).setFiles(path.join(SHOWCASE, `${UPLOAD.clip}.mp4`));
        await settled(page, 1200);
        const title = page.getByPlaceholder(/Give it a name/);
        await title.fill("");
        await type(page, title, UPLOAD.title, 45);
        await pause(page, 500);
        await press(page, page.getByRole("radio", { name: /Paid unlock/ }));
        await pause(page, 600);
        const price = page.locator('input[type="number"]').first();
        await press(page, price, 200);
        await price.fill("6");
        await pause(page, 1600); // what the fan pays, the fee, what she keeps
        const all = page.getByText(/I confirm all three/);
        if (await all.isVisible().catch(() => false)) await press(page, all);
        else for (const box of await page.getByRole("checkbox").all()) await press(page, box, 200);
        await pause(page, 600);
        await press(page, page.getByRole("button", { name: /^Publish$/ }));
        await page.getByText(/Your video is on its way/).waitFor({ timeout: 30_000 });
        await pause(page, 3800);
      };
    },
  },

  "elena-live": {
    who: "elena",
    async open(page, ids) {
      await page.goto(`${BASE}/me`);
      return async () => {
        await pause(page, 2200);
        // Two fans, elsewhere, at this moment — through the app's own API, as their browsers would.
        const [sam, lina] = await Promise.all([api("sam"), api("lina")]);
        await sam.call("POST", "/api/videos/unlock-video", { videoId: ids.neonRain, amountCents: 1500, gateway: "CREDITS" });
        await pause(page, 3400);
        const { items } = await lina.call("GET", "/api/auctions?tab=open");
        const highest = items.find((a) => a.id === ids.auction)?.highestBidCents ?? CAST.auction.startingPriceCents;
        await lina.call("POST", `/api/auctions/${ids.auction}/bids`, { amountCents: highest + 1000 });
        await pause(page, 3400);
        await press(page, page.getByRole("button", { name: /Notifications/ }).first());
        await pause(page, 3600);
      };
    },
  },

  "elena-story": {
    who: "elena",
    async open(page) {
      await page.goto(`${BASE}/@${elena.username}`);
      return async () => {
        await pause(page, 1200);
        await press(page, page.getByRole("button", { name: /Watch stories/ }), 600);
        await settled(page, 1400);
        await press(page, page.getByRole("button", { name: /^Activity/ }).first());
        await settled(page, 3400);
        await press(page, page.getByRole("tab", { name: /^Tips/ }).or(page.getByRole("button", { name: /^Tips$/ })).first());
        await pause(page, 4200);
      };
    },
  },

  "elena-earnings": {
    who: "elena",
    poster: 0.2,
    async open(page) {
      await page.goto(`${BASE}/me/earnings`);
      return async () => {
        await pause(page, 2200);
        await page.getByText(/After the 10% platform fee/).first().hover().catch(() => {});
        await pause(page, 1400);
        await glide(page, 420, 2000);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
        await pause(page, 1000);
        await press(page, page.getByRole("button", { name: /^Withdraw$/ }).first());
        await pause(page, 1500);
        await press(page, page.getByRole("button", { name: /^Request \$/ }));
        await pause(page, 3400);
      };
    },
  },
};

/** The home card: the strongest seconds of the day, cut from the clips (each [clip, from, to] in seconds). */
const SHOWCASE_CUTS = [
  ["alex-discover", 0.5, 5.5],
  ["alex-story", 2.5, 9],
  ["alex-unlock", 2.5, 9],
  ["elena-live", 4, 10],
  ["elena-earnings", 0.5, 5],
];

/** Encodes a recording to the three published files. */
function encode(source, target, { start = 0, poster = 0.7, filter = "", hold = 1.2 } = {}) {
  // The last frame holds a second: the result of the gesture (a tip sent, a bid in the lead) stays readable.
  const vf = `${filter}tpad=stop_mode=clone:stop_duration=${hold},fps=25,scale=1280:800:flags=lanczos`;
  const trim = ["-y", "-loglevel", "error", "-ss", start.toFixed(2), "-i", source, "-vf", vf, "-an"];
  execFileSync("ffmpeg", [...trim, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", `${target}.webm`]);
  execFileSync("ffmpeg", [...trim, "-c:v", "libx264", "-crf", "26", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${target}.mp4`]);
  const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", `${target}.mp4`]).toString());
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", (duration * poster).toFixed(2), "-i", `${target}.mp4`, "-frames:v", "1", "-q:v", "4", `${target}.jpg`]);
  return duration;
}

/** Records one clip, then encodes it next to the others. */
async function record(id, ids) {
  const clip = CLIPS[id];
  const ctx = await context(clip.who, true);
  const page = await ctx.newPage();
  const opened = Date.now();
  const play = await clip.open(page, ids);
  await settled(page, 1200); // fonts, data, pictures settle before the clip starts
  const start = (Date.now() - opened) / 1000;
  try {
    await play();
  } finally {
    await ctx.close();
  }
  const source = await page.video().path();
  await writeFile(path.join(raw, `${id}.path`), source);
  const duration = encode(source, path.join(OUT, id), { start, poster: clip.poster });
  process.stdout.write(`✓ ${id}  ${duration.toFixed(1)} s → ${path.relative(process.cwd(), path.join(OUT, id))}.{webm,mp4,jpg}\n`);
}

/** The home card's clip, from the published mp4s (cross-faded). */
function showcase() {
  const inputs = SHOWCASE_CUTS.flatMap(([id, from, to]) => ["-ss", String(from), "-t", String(to - from), "-i", path.join(OUT, `${id}.mp4`)]);
  const fade = 0.4;
  let chain = "";
  let last = "[0:v]";
  let offset = 0;
  SHOWCASE_CUTS.forEach(([, from, to], i) => {
    if (i === 0) return (offset = to - from - fade);
    const out = i === SHOWCASE_CUTS.length - 1 ? "[v]" : `[x${i}]`;
    chain += `${last}[${i}:v]xfade=transition=fade:duration=${fade}:offset=${offset.toFixed(2)}${out};`;
    last = out;
    offset += to - from - fade;
  });
  const joined = path.join(raw, "showcase.mp4");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", chain.replace(/;$/, ""), "-map", "[v]", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", joined]);
  const duration = encode(joined, path.join(OUT, "showcase"), { poster: 0.3, hold: 0 });
  process.stdout.write(`✓ showcase  ${duration.toFixed(1)} s → ${path.relative(process.cwd(), path.join(OUT, "showcase"))}.{webm,mp4,jpg}\n`);
}

try {
  const ids = {};
  const [alex, elenaApi] = await Promise.all([api("alex"), api("elena")]);
  ids.acoustic = await videoId(elenaApi, "acoustic");
  ids.neonRain = await videoId(elenaApi, "neonRain");
  ids.auction = (await alex.call("GET", "/api/auctions?tab=open")).items.find((a) => a.title === video(CAST.auction.video).title)?.id;
  hls = LOCAL_MEDIA ? await localMedia(raw) : null;
  const wanted = Object.keys(CLIPS).filter((id) => ONLY.length === 0 || ONLY.includes(id));
  for (const id of wanted) await record(id, ids);
  if (ONLY.length === 0 || ONLY.includes("showcase")) showcase();
} finally {
  await browser.close();
  await rm(raw, { recursive: true, force: true });
}
