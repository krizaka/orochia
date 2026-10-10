// Product tour of the real application, recorded for krizaka.com (public/assets/orochia/tour/<clip>.{webm,mp4,jpg}).
//
//   npm run setup                          # PostgreSQL, migrations, the development seed (Elena, Mia, Alex, Sam)
//   npm run build && SEARCH_INDEXING=off NEXT_PUBLIC_APP_URL=http://localhost:3100 npx next start apps/web -p 3100
//                                          # a production build: no dev overlay in the frames (SEARCH_INDEXING=off
//                                          # keeps test top-ups, PAYMENTS_CREDITS_MODE=test in .env)
//   npm run record:tour -- prepare         # the demo the clips need, made through the app's own API (below)
//   npm run record:tour                    # every clip; `-- stories unlock` re-records some. OROCHIA_URL, OUT (tour/)
//
// The people are the seed's: Alex Vance (a fan) watches, tips, unlocks, bids and backs; Elena Vox (a creator) is paid.
// Never the operator account. `prepare` makes, as each of them would in the app: Alex's and Sam's credits (test
// top-ups), Mia's rehearsal video as a paid unlock, Elena's auction (Sam bids first) and her episode goal (Sam backs
// it first), and Elena's video story (a showcase clip, uploaded to Bunny over Tus like the app does). It is idempotent
// except for the story, which it posts only when Elena has no video story up.
//
// The figures on screen are the ledger's: the seed's payments and what the clips themselves pay. The unlock, the tip,
// the bid and the pledge are real (credits) — re-recording those clips needs the database as `prepare` left it
// (npm run db:dump after prepare, npm run db:restore before a new take).
//
// Video delivery: when the Bunny CDN of the environment does not serve (TOUR_LOCAL_MEDIA=1, the default), the
// browser's requests to it are answered with the repository's showcase clips (apps/web/public/showcase, licences in
// apps/web/public/CREDITS.md) packaged as HLS by ffmpeg — the access check, the signed URL and the player are the
// app's own; only the bytes come from this machine. TOUR_LOCAL_MEDIA=0 plays what Bunny serves.
//
// Each clip is recorded at 1440×900 by Playwright, then encoded by ffmpeg to 1280×800 at 25 fps: VP9 .webm, H.264
// .mp4 (faststart) and a .jpg poster. Sign-in happens outside the recording.
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOWCASE = path.join(ROOT, "apps/web/public/showcase");
const BASE = (process.env.OROCHIA_URL || "http://localhost:3100").replace(/\/$/, "");
const OUT = path.resolve(process.env.OUT || "tour");
const LOCAL_MEDIA = process.env.TOUR_LOCAL_MEDIA !== "0";
const ARGS = process.argv.slice(2);
const PREPARE = ARGS.includes("prepare");
const ONLY = ARGS.filter((a) => a !== "prepare");
const VIEWPORT = { width: 1440, height: 900 };
const STATE = path.join(os.tmpdir(), `orochia-tour-${new URL(BASE).port || "80"}.json`);

/** The seed's people (packages/db/src/seed.ts). */
const PEOPLE = {
  alex: { identifier: "alex@sanctuary.io", password: "alex1234" },
  sam: { identifier: "sam@sanctuary.io", password: "sam1234" },
  mia: { identifier: "mia@orochia.org", password: "mia1234" },
  elena: { identifier: "elena@orochia.org", password: "elena1234" },
};
/** Seed videos (by title): Mia's rehearsal becomes the paid unlock, Elena's rough cut is auctioned. */
const REHEARSAL = /^Rehearsal Tapes/;
const ROUGH_CUT = /^Inner Circle — Rough Cut$/;
const GOAL = {
  kind: "GOAL",
  title: "Episode 02 — shot in the rain in Shinjuku",
  description: "If we reach the goal, I film the next episode on a rainy night in Shinjuku, in 4K, and every backer watches it first.",
  deliverable: "VIDEO",
  deliveryDays: 14,
  goalCents: 15000,
  reward: "BACKERS",
};
const STORY = { clip: "story-3", caption: "Night shoot tonight — back the episode 02 goal." };
const REPLY = "That light is unreal. Backing the goal!";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("✗ Playwright is missing: npm install (it is a dev dependency), then npx playwright install chromium.");
  process.exit(2);
}
if (!(await fetch(BASE).then((r) => r.ok, () => false))) {
  console.error(`✗ Nothing answers at ${BASE}: start the app (see the top of this file) or set OROCHIA_URL.`);
  process.exit(2);
}

/** An API session as one of the seed's people. */
async function api(who) {
  const res = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(PEOPLE[who]) });
  if (!res.ok) throw new Error(`Sign-in as ${PEOPLE[who].identifier} failed (${res.status}): npm run db:seed first.`);
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const call = async (method, url, body) => {
    const r = await fetch(BASE + url, { method, headers: { cookie, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${who}: ${method} ${url} → ${r.status} ${JSON.stringify(json)}`);
    return json;
  };
  return { cookie, call };
}

/** The app's id of a seed video, from its creator's page (the creator sees all of theirs). */
async function videoId(session, username, title) {
  const html = await fetch(`${BASE}/@${username}`, { headers: { cookie: session.cookie } }).then((r) => r.text());
  for (const id of new Set([...html.matchAll(/\/watch\/([0-9a-f-]{36})/g)].map((m) => m[1]))) {
    const details = await session.call("GET", `/api/videos/${id}/details`).catch(() => null);
    if (title.test(details?.video?.title ?? "")) return id;
  }
  throw new Error(`No video matching ${title} on @${username}'s page: npm run db:seed first.`);
}

async function prepare() {
  const [alex, sam, mia, elena] = await Promise.all(["alex", "sam", "mia", "elena"].map(api));
  /** Credits through a test top-up when the balance is below `floor` (cents). */
  const credits = async (who, s, pack, floor) => {
    if ((await s.call("GET", "/api/me/wallet")).balanceCents >= floor) return;
    await s.call("POST", "/api/me/wallet/topups", { packId: pack, gateway: "TEST" });
    console.log(`✓ ${who}'s credits topped up (test top-up)`);
  };
  await credits("Alex", alex, "max", 5000);
  const rehearsal = await videoId(mia, "miasterling", REHEARSAL);
  await mia.call("PATCH", `/api/videos/${rehearsal}`, {
    title: "Rehearsal Tapes — The Unplugged Evening",
    description: "Unpolished rehearsals: the whole evening, three new songs and the ones that did not make the record.",
    visibility: "TIPPED_UNLOCKED",
    minTipAmountCents: 800,
  });
  console.log("✓ Mia's rehearsal is a paid unlock ($8)");

  if ((await elena.call("GET", "/api/auctions?tab=selling")).items.length === 0) {
    const now = Date.now();
    const { auctionId } = await elena.call("POST", "/api/auctions", {
      videoId: await videoId(elena, "elenavox", ROUGH_CUT),
      startingPriceCents: 2000,
      startsAt: new Date(now + 5_000).toISOString(),
      endsAt: new Date(now + 3 * 86_400_000).toISOString(),
      rights: "WATCH",
      settlement: "CREATOR_DECIDES",
    });
    await new Promise((r) => setTimeout(r, 7_000));
    await credits("Sam", sam, "plus", 2000);
    await sam.call("POST", `/api/auctions/${auctionId}/bids`, { amountCents: 2000 });
    console.log("✓ Elena's rough cut is up for auction; Sam bid first");
  }
  if ((await elena.call("GET", "/api/challenges?tab=mine")).items.length === 0) {
    const { challengeId } = await elena.call("POST", "/api/challenges", { ...GOAL, deadline: new Date(Date.now() + 6 * 86_400_000).toISOString() });
    await credits("Sam", sam, "plus", 2500);
    await sam.call("POST", `/api/challenges/${challengeId}/pledges`, { amountCents: 2500 });
    console.log("✓ Elena's episode goal is open; Sam backed it first");
  }

  const { stories } = await elena.call("GET", "/api/me/stories");
  if (!stories.some((s) => s.mediaType === "VIDEO" && s.status === "READY" && new Date(s.expiresAt) > new Date())) {
    const tus = await import("tus-js-client");
    const file = readFileSync(path.join(SHOWCASE, `${STORY.clip}.mp4`));
    const { session } = await elena.call("POST", "/api/stories/upload-session", { caption: STORY.caption, audience: "PUBLIC", sizeBytes: file.length });
    await new Promise((resolve, reject) =>
      new tus.Upload(file, {
        endpoint: session.tusEndpoint,
        retryDelays: [0, 3000, 5000],
        headers: {
          AuthorizationSignature: session.headers.AuthorizationSignature,
          AuthorizationExpire: String(session.headers.AuthorizationExpire),
          VideoId: session.headers.VideoId,
          LibraryId: String(session.headers.LibraryId),
        },
        metadata: { filetype: "video/mp4", title: "story" },
        onError: reject,
        onSuccess: resolve,
      }).start(),
    );
    console.log("✓ Elena's video story uploaded; it shows once Bunny has encoded it (the rail reconciles)");
  }
  await writeFile(STATE, JSON.stringify({ rehearsal }));
}

/** Showcase clips packaged as HLS once, served in place of the CDN (see the top of this file). */
async function localMedia(raw) {
  const dir = path.join(raw, "hls");
  for (const clip of ["feed-1", STORY.clip]) {
    await mkdir(path.join(dir, clip), { recursive: true });
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...(clip === STORY.clip ? [] : ["-stream_loop", "3"]), "-i", path.join(SHOWCASE, `${clip}.mp4`),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-g", "50", "-an", "-f", "hls", "-hls_time", "2", "-hls_playlist_type", "vod",
      "-hls_segment_filename", path.join(dir, clip, "seg%03d.ts"), path.join(dir, clip, "playlist.m3u8")]);
  }
  return dir;
}

const state = () => JSON.parse(readFileSync(STATE, "utf8"));
const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });
const raw = await mkdtemp(path.join(os.tmpdir(), "orochia-tour-"));
const pause = (page, ms) => page.waitForTimeout(ms);

const sessions = new Map();

/** A browser context in dark English, signed in as `who` (or a visitor), recording when asked. */
async function context(who, record, media, gate) {
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: "dark",
    storageState: who ? sessions.get(who) : undefined,
    recordVideo: record ? { dir: raw, size: VIEWPORT } : undefined,
  });
  await ctx.addInitScript((gate) => {
    try {
      localStorage.setItem("kz-theme", "dark");
      if (!gate) localStorage.setItem("orochia_age_verified", "true"); // the home's visitor answers the gate on camera
    } catch {}
  }, Boolean(gate));
  if (who && !sessions.has(who)) {
    // Once per person and run: sign-in is rate-limited.
    const res = await ctx.request.post(`${BASE}/api/auth/login`, { data: PEOPLE[who] });
    if (!res.ok()) throw new Error(`Sign-in as ${PEOPLE[who].identifier} failed (${res.status()})`);
    sessions.set(who, { cookies: (await ctx.storageState()).cookies, origins: [] });
  }
  if (media) {
    // One clip per recording: the only video it plays (the unlocked one, or Elena's story).
    await ctx.route(/\.b-cdn\.net\//, async (route) => {
      const name = route.request().url().split("?")[0].split("/").pop();
      const poster = /\.(jpe?g|webp|png)$/.test(name);
      const file = poster ? path.join(SHOWCASE, `${media.clip}.jpg`) : path.join(media.dir, media.clip, name);
      if (!existsSync(file)) return route.fulfill({ status: 404 });
      const contentType = poster ? "image/jpeg" : name.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t";
      await route.fulfill({ status: 200, contentType, body: await readFile(file), headers: { "access-control-allow-origin": "*" } });
    });
  }
  return ctx;
}

/** Scrolls the page smoothly by `dy` pixels. */
async function glide(page, dy, ms = 1400) {
  await page.evaluate((dy) => window.scrollBy({ top: dy, behavior: "smooth" }), dy);
  await pause(page, ms);
}

/** Moves the pointer onto an element, then clicks it — a viewer can follow the gesture. */
async function press(page, locator, ms = 500) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 14 });
  await pause(page, ms);
  await locator.click();
}

/** Each clip: who plays it, then a function that opens the page and returns what to play once it has settled. */
const CLIPS = {
  // The home a visitor lands on: the 18+ gate, then the sections that sell.
  feed: {
    who: null,
    gate: true,
    poster: 0.17, // the hero: the poster is also the product page's backdrop
    async open(page) {
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      return async () => {
        await pause(page, 1600);
        await press(page, page.getByRole("button", { name: /I am 18 or older/ }));
        await pause(page, 3800); // the phone plays the app
        for (const dy of [700, 800, 800, 800, 800, 800]) await glide(page, dy, 1700);
        await pause(page, 800);
      };
    },
  },

  // Explore: the sections, a tag, a search.
  community: {
    who: null, // a visitor: Explore is public, and suggests every creator
    async open(page) {
      await page.goto(`${BASE}/explore`, { waitUntil: "networkidle" });
      return async () => {
        await pause(page, 1800);
        for (const dy of [560, 640, 640, 640]) await glide(page, dy, 1500);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
        await pause(page, 1200);
        await press(page, page.getByRole("button", { name: /cinematic/i }).or(page.getByRole("link", { name: /cinematic/i })).first());
        await pause(page, 2400);
        await press(page, page.getByRole("button", { name: /^All$/ }).or(page.getByRole("link", { name: /^All$/ })).first());
        await pause(page, 1000);
        const box = page.getByPlaceholder(/Search videos, creators, stories/);
        await press(page, box);
        await box.fill("");
        await box.pressSequentially("acoustic", { delay: 90 });
        await page.keyboard.press("Enter");
        await pause(page, 2800);
      };
    },
  },

  // Stories: the ring on Elena's profile, her video story with sound, a like, a private reply, a tip.
  stories: {
    who: "alex",
    media: STORY.clip,
    poster: 0.3,
    async open(page) {
      await page.goto(`${BASE}/@elenavox`, { waitUntil: "networkidle" });
      return async () => {
        await pause(page, 1500);
        await press(page, page.getByRole("button", { name: /Watch stories/ }), 700);
        await pause(page, 1200);
        const next = page.getByRole("button", { name: "Next story" });
        for (let i = 0; i < 3 && !(await page.getByText(STORY.caption).isVisible()); i++) {
          await press(page, next, 300);
          await pause(page, 1400);
        }
        // A 6-second story: typing a reply and the tip panel hold it (the viewer pauses for both).
        const sound = page.getByRole("button", { name: /Tap for sound|Turn sound on/ }).first();
        if (await sound.isVisible()) await press(page, sound, 300);
        await pause(page, 500);
        const reply = page.getByPlaceholder(/Reply to Elena Vox/);
        await press(page, reply, 300);
        await reply.pressSequentially(REPLY, { delay: 45 });
        await pause(page, 500);
        await page.keyboard.press("Enter");
        await pause(page, 500);
        await press(page, page.getByRole("button", { name: /^Like$/ }).last(), 250);
        await pause(page, 300);
        await press(page, page.getByRole("button", { name: /Send a tip to Elena Vox/ }), 250);
        await pause(page, 1400);
        await press(page, page.getByRole("button", { name: /^Pay \$/ }));
        await pause(page, 3000);
      };
    },
  },

  // Unlock: a paid video, paid with credits, playing at once.
  unlock: {
    who: "alex",
    media: "feed-1",
    async open(page) {
      await page.goto(`${BASE}/watch/${state().rehearsal}`, { waitUntil: "networkidle" });
      return async () => {
        await pause(page, 2000);
        await press(page, page.getByRole("button", { name: /Unlock for/ }));
        await pause(page, 1500);
        await press(page, page.getByRole("button", { name: /^Pay \$/ }));
        await pause(page, 2500);
        const play = page.getByRole("button", { name: /^Play/ }).first();
        if (await play.isVisible().catch(() => false)) await press(page, play);
        await pause(page, 5000);
      };
    },
  },

  // Auctions: the open auction, a bid that takes the lead.
  auctions: {
    who: "alex",
    async open(page) {
      await page.goto(`${BASE}/auctions`, { waitUntil: "networkidle" });
      return async () => {
        await pause(page, 2000);
        await press(page, page.getByText("Inner Circle — Rough Cut").first());
        await page.waitForURL(/#auction/);
        await pause(page, 2600);
        const bid = page.getByRole("radio").nth(1); // the second suggested amount
        await press(page, bid);
        await pause(page, 800);
        await press(page, page.getByRole("button", { name: /Place bid/ }));
        await pause(page, 4200);
      };
    },
  },

  // Challenges: Elena's goal, Alex backs it, the ring moves.
  challenges: {
    who: "alex",
    async open(page) {
      await page.goto(`${BASE}/challenges`, { waitUntil: "networkidle" });
      return async () => {
        await pause(page, 2000);
        await press(page, page.getByText(GOAL.title).first());
        await page.waitForURL(/\/challenges\/[0-9a-f-]{36}/);
        await pause(page, 2400);
        await press(page, page.getByRole("radio", { name: /\$25\.00/ }).or(page.getByRole("button", { name: /^\$25\.00$/ })).first());
        await pause(page, 700);
        await press(page, page.getByRole("button", { name: /^Pledge/ }));
        await pause(page, 4200);
      };
    },
  },

  // Getting paid: Elena's earnings — 90 % after the platform fee, the payments that just came in, a withdrawal.
  studio: {
    who: "elena",
    async open(page) {
      await page.goto(`${BASE}/earnings`, { waitUntil: "networkidle" });
      return async () => {
        await pause(page, 2600);
        await page.getByText(/After the 10% platform fee/).first().hover().catch(() => {});
        await pause(page, 1600);
        await glide(page, 560, 1800);
        await pause(page, 1600);
        await glide(page, 520, 1800);
        await pause(page, 1400);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
        await pause(page, 1200);
        await press(page, page.getByRole("button", { name: /^Withdraw$/ }).first());
        await pause(page, 3200);
      };
    },
  },
};

/** Records one clip, then encodes it next to the others. */
async function record(id, hls) {
  const clip = CLIPS[id];
  const ctx = await context(clip.who, true, clip.media && hls ? { dir: hls, clip: clip.media } : null, clip.gate);
  const page = await ctx.newPage();
  const opened = Date.now();
  const at = () => (Date.now() - opened) / 1000;
  const play = await clip.open(page);
  await pause(page, 1500); // fonts, data, first paint settle before the clip starts
  const start = at();
  try {
    await play();
  } finally {
    await ctx.close();
  }
  const source = await page.video().path();
  const target = path.join(OUT, id);
  const trim = ["-y", "-loglevel", "error", "-ss", start.toFixed(2), "-i", source, "-vf", "fps=25,scale=1280:800:flags=lanczos", "-an"];
  execFileSync("ffmpeg", [...trim, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "42", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", `${target}.webm`]);
  execFileSync("ffmpeg", [...trim, "-c:v", "libx264", "-crf", "28", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${target}.mp4`]);
  const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", `${target}.mp4`]).toString());
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", (duration * (clip.poster ?? 0.7)).toFixed(2), "-i", `${target}.mp4`, "-frames:v", "1", "-q:v", "4", `${target}.jpg`]);
  process.stdout.write(`✓ ${id}  ${duration.toFixed(1)} s → ${path.relative(process.cwd(), target)}.{webm,mp4,jpg}\n`);
}

try {
  if (PREPARE) await prepare();
  const ids = Object.keys(CLIPS).filter((id) => ONLY.length === 0 || ONLY.includes(id));
  if (!(PREPARE && ONLY.length === 0)) {
    if (!existsSync(STATE)) throw new Error("Run `npm run record:tour -- prepare` first.");
    const hls = LOCAL_MEDIA ? await localMedia(raw) : null;
    for (const id of ids) await record(id, hls);
  }
} finally {
  await browser.close();
  await rm(raw, { recursive: true, force: true });
}
