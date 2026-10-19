#!/usr/bin/env node
/**
 * The core journey on the REAL dev backend, as two demo personas (a creator and a fan — never an operator, never a QA
 * account by name): upload → encode → watch → tip → earnings. Dev preview `journey.core` (orochia#240). Everything goes
 * through the public API of dev.orochia.com, never SQL; the video is a short synthetic test clip made here by ffmpeg
 * (said so in its title) and uploaded to Bunny Stream through Orochia's own Tus session; Bunny encodes it.
 *
 *   node scripts/journey-dev.mjs [--base https://dev.orochia.com] [--tip-cents 100] [--report <file.json>]
 *                                [--record <dir>] [--keep]
 *
 *   --report  the steps with their ids (video id, payment, ledger deltas) and the edge's request id of every call.
 *   --record  also films the fan's watch page and tip (Playwright, 1280×720) into <dir>/journey.webm.
 *   --keep    leave the clip online (by default the creator removes it at the end, so dev keeps no residue).
 *
 * Credentials come from the secret store (`~/.krizaka-worktrees/tools/secret.sh @orochia KEY`: OROCHIA_CREATOR_*,
 * OROCHIA_FAN2_*) or from the environment — read into memory, never printed.
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { clipTitle, creatorShareCents, isHlsPlaylist, requestIdOf, step, verdict } from "./journey-lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../apps/web/package.json"));
const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const BASE = opt("base", "https://dev.orochia.com").replace(/\/$/, "");
const TIP_CENTS = Number(opt("tip-cents", "100"));
const REPORT = opt("report");
const RECORD = opt("record");
const KEEP = args.includes("--keep");

const secret = (key) => {
  if (process.env[key]) return process.env[key];
  const tool = path.join(os.homedir(), ".krizaka-worktrees", "tools", "secret.sh");
  try {
    return execFileSync(tool, ["@orochia", key], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
};

const steps = [];
const log = (msg) => console.log(msg);

/** One signed-in person: a fetch that carries the session cookie and remembers the edge's id of every call. */
async function person(prefix) {
  const jar = new Map();
  const call = async (url, init = {}) => {
    const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(BASE + url, { ...init, headers: { "content-type": "application/json", cookie, ...(init.headers ?? {}) }, redirect: "manual" });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return res;
  };
  const identifier = secret(`${prefix}_EMAIL`);
  const password = secret(`${prefix}_PASSWORD`);
  if (!identifier || !password) throw new Error(`${prefix}_EMAIL / ${prefix}_PASSWORD are not in the secret store or the environment`);
  const res = await call("/api/auth/login", { method: "POST", body: JSON.stringify({ identifier, password }) });
  if (!res.ok) throw new Error(`sign-in as ${prefix} failed (${res.status})`);
  return { call, jar, who: prefix };
}

const json = async (res) => res.json().catch(() => ({}));

// ── The clip: 6 s, vertical, made here (nothing downloaded, nothing licensed) ─────────────────────────────────────────
const work = fs.mkdtempSync(path.join(os.tmpdir(), "orochia-journey-"));
const clip = path.join(work, "journey.mp4");
const made = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=720x1280:rate=25:duration=6", "-f", "lavfi", "-i", "sine=frequency=330:duration=6", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-c:a", "aac", "-shortest", "-movflags", "+faststart", clip], { stdio: "inherit" });
if (made.status !== 0) throw new Error("ffmpeg could not make the test clip");

const creator = await person("OROCHIA_CREATOR");
const fan = await person("OROCHIA_FAN2");
log(`signed in as two demo personas on ${BASE}`);

// ── Balances before ───────────────────────────────────────────────────────────────────────────────────────────────────
const walletBefore = (await json(await fan.call("/api/me/wallet"))).balanceCents ?? 0;
const earnedBefore = (await json(await creator.call("/api/creator/payouts"))).data ?? {};
const feePercent = earnedBefore.platformFeePercent ?? 10;

// ── 1. upload: a real Tus session, the bytes go to Bunny ──────────────────────────────────────────────────────────────
const title = clipTitle(new Date());
const created = await creator.call("/api/videos/create-upload-session", {
  method: "POST",
  body: JSON.stringify({ title, description: "A synthetic test clip made by scripts/journey-dev.mjs to prove upload, encode, watch, tip and earnings on dev. It removes itself.", visibility: "PUBLIC", tags: ["journey-check"], sizeBytes: fs.statSync(clip).size }),
});
const session = await json(created);
if (!created.ok) {
  steps.push(step("upload", { ok: false, status: created.status, ids: { request: requestIdOf(created.headers) }, note: session.error ?? "session refused" }));
  await finish();
}
const tus = require("tus-js-client");
await new Promise((resolve, reject) => {
  new tus.Upload(fs.createReadStream(clip), {
    endpoint: session.session.tusEndpoint,
    uploadSize: fs.statSync(clip).size,
    retryDelays: [0, 3000, 5000],
    headers: { AuthorizationSignature: session.session.headers.AuthorizationSignature, AuthorizationExpire: String(session.session.headers.AuthorizationExpire), VideoId: session.session.headers.VideoId, LibraryId: String(session.session.headers.LibraryId) },
    metadata: { filetype: "video/mp4", title: "journey.mp4" },
    onError: reject,
    onSuccess: resolve,
  }).start();
});
const videoId = session.videoId;
steps.push(step("upload", { ok: true, status: created.status, ids: { videoId, request: requestIdOf(created.headers) }, note: "Tus upload to Bunny Stream finished" }));
log(`uploaded ${videoId}`);

// ── 2. encode: Bunny encodes, Orochia settles the row (webhook, or the catch-up of the details route) ─────────────────
let ready = null;
const started = Date.now();
for (let i = 0; i < 90 && !ready; i++) {
  await new Promise((r) => setTimeout(r, 4000));
  const res = await creator.call(`/api/videos/${videoId}/details`);
  const body = await json(res);
  if (body.video?.status === "READY") ready = { body: body.video, request: requestIdOf(res.headers) };
  // Until the details route catches up a lost webhook by itself (orochia#315), the creator's dashboard does.
  else if (i % 5 === 4) await creator.call("/api/me/dashboard");
}
steps.push(step("encode", { ok: Boolean(ready), status: ready ? 200 : null, ids: { videoId, request: ready?.request ?? null }, note: ready ? `READY after ${Math.round((Date.now() - started) / 1000)} s, ${ready.body.width}x${ready.body.height}, ${ready.body.durationSeconds} s` : "still not READY after 6 minutes" }));
if (!ready) await finish();
log(`READY after ${Math.round((Date.now() - started) / 1000)} s`);

// ── 3. watch: the fan is granted a signed HLS stream and the playlist answers ─────────────────────────────────────────
const streamRes = await fan.call(`/api/videos/${videoId}/stream`);
const stream = await json(streamRes);
let playlistOk = false;
const url = stream.streamUrl ?? stream.data?.streamUrl ?? stream.url;
if (url) {
  const pl = await fetch(url);
  playlistOk = pl.ok && isHlsPlaylist(await pl.text());
}
steps.push(step("watch", { ok: streamRes.ok && playlistOk, status: streamRes.status, ids: { videoId, request: requestIdOf(streamRes.headers) }, note: playlistOk ? "signed HLS master playlist answered" : "no playable playlist" }));
log(`watch: ${playlistOk ? "playlist ok" : "NO playlist"}`);

// ── (optional) the fan's screen, recorded ─────────────────────────────────────────────────────────────────────────────
if (RECORD) {
  fs.mkdirSync(RECORD, { recursive: true });
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: RECORD, size: { width: 1280, height: 720 } }, colorScheme: "dark" });
  await context.addCookies([...fan.jar].map(([name, value]) => ({ name, value, url: BASE })));
  await context.addInitScript(() => { try { localStorage.setItem("orochia_age_verified", "true"); localStorage.setItem("kz-theme", "dark"); } catch {} });
  const page = await context.newPage();
  await page.goto(`${BASE}/watch/${videoId}`, { waitUntil: "networkidle" }).catch(() => undefined);
  await page.waitForTimeout(6000);
  await context.close();
  await browser.close();
  const recorded = fs.readdirSync(RECORD).filter((f) => f.endsWith(".webm")).map((f) => path.join(RECORD, f));
  if (recorded[0]) fs.renameSync(recorded[0], path.join(RECORD, "journey.webm"));
}

// ── 4. tip: paid in credits, settled once on the double-entry ledger ──────────────────────────────────────────────────
const tipRes = await fan.call("/api/videos/unlock-video", { method: "POST", body: JSON.stringify({ videoId, amountCents: TIP_CENTS, gateway: "CREDITS" }) });
const tip = await json(tipRes);
const walletAfter = (await json(await fan.call("/api/me/wallet"))).balanceCents ?? 0;
const spent = walletBefore - walletAfter;
steps.push(step("tip", { ok: tipRes.ok && tip.settled === true && spent === TIP_CENTS, status: tipRes.status, ids: { videoId, request: requestIdOf(tipRes.headers) }, note: tipRes.ok ? `${TIP_CENTS} credits spent (balance ${walletBefore} → ${walletAfter})` : (tip.error ?? "refused") }));
log(`tip: ${tipRes.status} (spent ${spent})`);

// ── 5. earnings: the creator's ledger moved by the share, the fee written once ────────────────────────────────────────
await new Promise((r) => setTimeout(r, 1500));
const earnedRes = await creator.call("/api/creator/payouts");
const earnedAfter = (await json(earnedRes)).data ?? {};
const gained = (earnedAfter.lifetimeNetCents ?? 0) - (earnedBefore.lifetimeNetCents ?? 0);
const expected = creatorShareCents(TIP_CENTS, feePercent);
steps.push(step("earnings", { ok: earnedRes.ok && gained === expected, status: earnedRes.status, ids: { request: requestIdOf(earnedRes.headers) }, note: `creator ledger +${gained} (expected ${expected} at a ${feePercent} % fee)` }));
log(`earnings: +${gained} (expected ${expected})`);

await finish();

async function finish() {
  // Cleanup: the creator removes the test clip (dev keeps no residue); a clip with a settled payment may be refused.
  let removed = null;
  const id = steps.find((s) => s.ids?.videoId)?.ids.videoId;
  if (id && !KEEP) {
    const res = await creator.call(`/api/videos/${id}`, { method: "DELETE" });
    removed = res.ok ? "removed" : `kept (${res.status})`;
  }
  const result = { base: BASE, at: new Date().toISOString(), feePercent, steps, ...verdict(steps), removed };
  if (REPORT) fs.writeFileSync(REPORT, `${JSON.stringify(result, null, 2)}\n`);
  fs.rmSync(work, { recursive: true, force: true });
  console.log(`\n${result.proven ? "PROVEN" : "NOT PROVEN"}: ${steps.map((s) => `${s.name}${s.ok ? "" : " ✗"}`).join(" → ")}${removed ? ` · clip ${removed}` : ""}`);
  process.exit(result.proven ? 0 : 1);
}
