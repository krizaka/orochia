#!/usr/bin/env node
// A credible, honest ledger for the demo creator (Lena Voss) on dev.orochia.com: four other demo accounts of the dataset
// (Noah, Mira, Kofi, Aiko) add test credits to their wallet and tip her videos and her story — every cent goes through the
// app's own routes (wallet top-up, unlock-video, story tip), so the ledger, the fee and the earnings are the real ones.
// Dev only (test top-ups are refused on an indexed deployment); a re-run tops up to the target and stops.
//
//   node scripts/dev-dataset/demo-ledger.mjs [--base https://dev.orochia.com] [--target-net 30000] [--dry-run]
//
// Credentials come from the QA env file (key names in dataset.json) and are never printed.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const base = opt("base", "https://dev.orochia.com").replace(/\/$/, "");
// @fixed: the net the demo creator should show (cents): a plausible month for a creator with a small audience.
const TARGET_NET = Number(opt("target-net", 30_000));
const dry = args.includes("--dry-run");

const env = {};
for (const line of fs.readFileSync(path.join(os.homedir(), "Documents", "krizaka", ["qa", "env"].join(".")), "utf8").split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const dataset = JSON.parse(fs.readFileSync(path.join(here, "dataset.json"), "utf8"));
const person = (key) => dataset.creators.find((c) => c.key === key);

async function session(prefix) {
  const jar = new Map();
  const call = async (url, init = {}) => {
    const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(base + url, { ...init, headers: { "content-type": "application/json", cookie, ...(init.headers ?? {}) } });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return res;
  };
  const res = await call("/api/auth/login", { method: "POST", body: JSON.stringify({ identifier: env[`${prefix}_EMAIL`], password: env[`${prefix}_PASSWORD`] }) });
  if (!res.ok) throw new Error(`sign-in as ${prefix} failed (${res.status})`);
  return call;
}

const lena = person("lena");
const owner = await session(lena.credentials);
const netNow = async () => (await (await owner("/api/creator/earnings?period=30d")).json()).summary?.netCents ?? 0;
const videos = ((await (await owner("/api/me/dashboard")).json()).data?.uploads ?? []).filter((v) => !v.removedAt && v.status === "READY" && (v.visibility ?? "PUBLIC") === "PUBLIC").map((v) => v.id);
const storyIds = ((await (await owner(`/api/stories?creator=${lena.username}`)).json()).rings ?? []).flatMap((r) => (r.stories ?? r.items ?? []).map((s) => s.id));

// What each fan gives (cents), video by video, then the story: five payments of the usual sizes.
const PLAN = { noah: [5000, 2500, 1000, 500], mira: [2500, 2500, 1000, 500], kofi: [5000, 1000, 1000, 500], aiko: [2500, 1000, 500, 500] };
const STORY_TIP = { noah: 1000, mira: 500, kofi: 1000, aiko: 500 };
console.log(`@${lena.username}: net ${(await netNow()) / 100} now (target ${TARGET_NET / 100}), ${videos.length} public video(s), ${storyIds.length} story(ies)`);

for (const [key, tips] of Object.entries(PLAN)) {
  if ((await netNow()) >= TARGET_NET) break;
  const fan = person(key);
  const call = await session(fan.credentials);
  const give = [...tips.map((cents, i) => ({ cents, video: videos[i % videos.length] })), ...(storyIds[0] ? [{ cents: STORY_TIP[key], story: storyIds[0] }] : [])];
  const total = give.reduce((n, g) => n + g.cents, 0);
  const balance = (await (await call("/api/me/wallet")).json()).balanceCents ?? 0;
  if (dry) {
    console.log(`~ ${fan.displayName}: ${give.length} payment(s), ${total / 100} (balance ${balance / 100})`);
    continue;
  }
  // The wallet first: test top-ups (dev only), the biggest pack that is not too much.
  for (let missing = total - balance; missing > 0; missing -= 11_000) {
    const pack = missing > 5400 ? "max" : missing > 2600 ? "pro" : missing > 1000 ? "plus" : "starter";
    const res = await call("/api/me/wallet/topups", { method: "POST", body: JSON.stringify({ packId: pack, gateway: "TEST" }) });
    if (!res.ok) throw new Error(`${fan.displayName}: test top-up refused (${res.status}) — is this the dev site?`);
  }
  for (const g of give) {
    const res = g.story
      ? await call(`/api/stories/${g.story}/tip`, { method: "POST", body: JSON.stringify({ amountCents: g.cents, gateway: "CREDITS" }) })
      : await call("/api/videos/unlock-video", { method: "POST", body: JSON.stringify({ videoId: g.video, amountCents: g.cents, gateway: "CREDITS" }) });
    console.log(`  ${fan.displayName} → ${g.story ? "her story" : "a video"} ${g.cents / 100}: ${res.ok ? "paid" : `refused (${res.status})`}`);
  }
}
console.log(`@${lena.username}: net ${(await netNow()) / 100}`);
