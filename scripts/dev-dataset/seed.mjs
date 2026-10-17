#!/usr/bin/env node
// Seeds the development dataset of Orochia through its PUBLIC API, signed in as the QA creators — never SQL.
// Re-runnable after a database reset: it creates what is missing, keeps what matches, and with --prune deletes the
// creator's other videos (what they may delete in the app: not an auctioned or challenge-delivered one).
//
//   npm run dev:dataset -- --media-dir <folder with the .mp4 and manifest.json> [--base https://dev.orochia.com]
//                          [--env-file <QA credentials file>] [--prune] [--dry-run] [--only <creator key>]
//
// The media folder holds the clips made by Orazaka (dataset.json `generate` has the vertical prompts) and the
// manifest.json that says which run made each (`clips: [{ file, orazakaRunId, model }]`). Credentials come from the
// QA credentials file (OROCHIA_CREATOR_EMAIL / _PASSWORD…) and are never printed.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { problemOf } from "./thumbnails.mjs";
import { credit, diffCreator, isUpgrade, retag, validateDataset } from "./plan.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../apps/web/package.json"));

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const base = opt("base", "https://dev.orochia.com").replace(/\/$/, "");
const mediaDir = opt("media-dir");
const credentialsFile = opt("env-file", path.join(os.homedir(), "Documents", "krizaka", ["qa", "env"].join(".")));
const only = opt("only");
// --profile-media <folder from generate-profile-media.mjs>: each creator gets the avatar and cover named in dataset.json, through /api/uploads then the profile.
const profileMedia = opt("profile-media");
const dry = flag("dry-run");
const prune = flag("prune");

const dataset = JSON.parse(fs.readFileSync(path.join(here, "dataset.json"), "utf8"));
const problems = validateDataset(dataset);
if (problems.length) {
  console.error(`dataset.json: ${problems.length} problem(s)\n - ${problems.join("\n - ")}`);
  process.exit(2);
}
if (!mediaDir) {
  console.error("--media-dir <folder> is required (the clips made by Orazaka and their manifest.json)");
  process.exit(2);
}
const manifest = JSON.parse(fs.readFileSync(path.join(mediaDir, "manifest.json"), "utf8"));
const runOf = (file) => (manifest.clips ?? []).find((c) => c.file === file);

/** KEY=value lines, read into memory only. */
function readEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*[=:]\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = readEnv(credentialsFile);

/** A fetch that carries the session cookie of one signed-in person. */
async function session(prefix) {
  const jar = new Map();
  const call = async (url, init = {}) => {
    const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(base + url, { ...init, headers: { ...(init.body instanceof FormData ? {} : { "content-type": "application/json" }), cookie, ...(init.headers ?? {}) }, redirect: "manual" });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return res;
  };
  const identifier = env[`${prefix}_EMAIL`];
  const password = env[`${prefix}_PASSWORD`];
  if (!identifier || !password) throw new Error(`${prefix}_EMAIL / ${prefix}_PASSWORD are missing from the credentials file`);
  const res = await call("/api/auth/login", { method: "POST", body: JSON.stringify({ identifier, password }) });
  if (!res.ok) throw new Error(`sign-in as ${prefix} failed (${res.status})`);
  return call;
}

/** The creator's own videos, whatever their state (a clip still encoding counts: a re-run never uploads it twice). */
async function listOwn(call) {
  const res = await (await call("/api/me/dashboard")).json();
  return (res.data?.uploads ?? []).filter((v) => !v.removedAt).map((v) => ({ id: v.id, title: v.title, width: v.width, height: v.height, status: v.status, description: v.description ?? "" }));
}

async function sendOriginal(file, info) {
  const tus = require("tus-js-client");
  const size = fs.statSync(file).size;
  await new Promise((resolve, reject) => {
    new tus.Upload(fs.createReadStream(file), {
      endpoint: info.tusEndpoint,
      uploadSize: size,
      chunkSize: 5 * 1024 * 1024,
      retryDelays: [0, 3000, 5000, 10000],
      headers: {
        AuthorizationSignature: info.headers.AuthorizationSignature,
        AuthorizationExpire: String(info.headers.AuthorizationExpire),
        VideoId: info.headers.VideoId,
        LibraryId: String(info.headers.LibraryId),
      },
      metadata: { filetype: "video/mp4", title: path.basename(file) },
      onError: reject,
      onSuccess: resolve,
    }).start();
  });
}

async function waitReady(call, title, minutes = 15) {
  for (let i = 0; i < minutes * 6; i++) {
    const found = (await listOwn(call)).find((v) => v.title === title);
    if (found?.width) return found;
    await new Promise((r) => setTimeout(r, 10_000));
  }
  throw new Error(`"${title}" is not READY after ${minutes} min (Bunny is still encoding?)`);
}

/** The creator's current stories (they last 24 h: a story is posted again when none is left). */
async function ownStories(call, username) {
  const res = await (await call(`/api/stories?creator=${encodeURIComponent(username)}&pending=1`)).json().catch(() => ({}));
  return (res.rings ?? []).flatMap((r) => r.stories ?? r.items ?? []).length;
}

let failures = 0;
for (const creator of dataset.creators) {
  if (only && creator.key !== only) continue;
  const wanted = dataset.videos.filter((v) => v.creator === creator.key);
  const call = await session(creator.credentials);
  const have = await listOwn(call);
  const stale = (w, h) => fs.existsSync(path.join(mediaDir, w.file)) && ((Boolean(runOf(w.file)?.sound) && !h.description.includes("sound:")) || isUpgrade(runOf(w.file), h));
  const { upload, remove, replace } = diffCreator(wanted, have, stale);
  console.log(`\n${creator.displayName} (@${creator.username}): ${have.length} now · ${upload.length} to upload · ${replace.length} to replace (sound) · ${prune ? remove.length : 0} to delete`);
  const missing = upload.filter((v) => !fs.existsSync(path.join(mediaDir, v.file)) || !runOf(v.file));
  for (const v of missing) console.log(`  ! ${v.file}: not in ${mediaDir} (or no run in manifest.json) — generate it first`);
  if (dry) {
    for (const v of upload) console.log(`  + ${v.title}`);
    for (const h of prune ? remove : []) console.log(`  - ${h.title}`);
    continue;
  }
  // A QA fan listed as a creator opens their space the way the app does (birth date, then "become a creator");
  // an operator approves it in the console (2257 verification) — there is no other way and no SQL.
  const opened = await call("/api/me/become-creator", { method: "POST" });
  if (opened.status === 403) {
    await call("/api/me/birth-date", { method: "POST", body: JSON.stringify({ dateOfBirth: "1990-01-01" }) });
    await call("/api/me/become-creator", { method: "POST" });
  }
  if (profileMedia && creator.avatar && creator.banner) {
    const send = async (category, file) => {
      const form = new FormData();
      form.set("category", category);
      form.set("file", new Blob([fs.readFileSync(path.join(profileMedia, category, file))], { type: "image/webp" }), file);
      const res = await call("/api/uploads", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`upload of ${file} refused (${res.status})`);
      return body.data?.ref ?? body.data?.key ?? body.data?.path ?? body.data;
    };
    try {
      const avatar = await send("avatars", `${creator.avatar}-512.webp`);
      const banner = await send("banners", `${creator.banner}.webp`);
      const set = await call("/api/me/profile", { method: "PUT", body: JSON.stringify({ avatar, banner }) });
      console.log(`  avatar + cover ${set.ok ? "set" : `refused (${set.status})`}`);
    } catch (error) {
      console.log(`  ! avatar/cover: ${error.message}`);
    }
  }
  const links = creator.websiteUrl ? { websiteUrl: creator.websiteUrl } : {};
  const profile = await call("/api/me/profile", { method: "PUT", body: JSON.stringify({ displayName: creator.displayName, bio: `${creator.bio} — ${creator.niche}`, ...links }) });
  console.log(`  profile ${profile.ok ? "set" : `refused (${profile.status})`}`);
  for (const h of [...replace, ...(prune ? remove : [])]) {
    const res = await call(`/api/videos/${h.id}`, { method: "DELETE" });
    console.log(`  - ${h.title}: ${res.ok ? "deleted" : `kept (${res.status}: ${(await res.json().catch(() => ({}))).error ?? ""})`}`);
  }
  // The tags of what stays follow the dataset (a renamed tag needs no re-upload).
  for (const k of retag(wanted, have, new Set([...replace, ...(prune ? remove : [])].map((h) => h.id)))) {
    const res = await call(`/api/videos/${k.id}`, { method: "PATCH", body: JSON.stringify({ tags: k.tags }) });
    if (!res.ok) console.log(`  ! tags of ${k.id}: refused (${res.status})`);
  }
  // Stories (a vertical clip each, from the same media folder): the demo's step « tip a story » needs one to tip.
  for (const st of (dataset.stories ?? []).filter((x) => x.creator === creator.key)) {
    const file = path.join(mediaDir, st.file);
    if (!fs.existsSync(file)) {
      console.log(`  ! story ${st.file}: not in ${mediaDir}`);
      continue;
    }
    if ((await ownStories(call, creator.username)) > 0) {
      console.log(`  = story of @${creator.username} is still up`);
      continue;
    }
    try {
      const res = await call("/api/stories/upload-session", { method: "POST", body: JSON.stringify({ caption: st.caption, audience: "PUBLIC", sizeBytes: fs.statSync(file).size, durationSeconds: 5 }) });
      const body = await res.json();
      if (!res.ok) throw new Error(`session refused (${res.status}): ${body.error ?? ""}`);
      await sendOriginal(file, body.session);
      console.log(`  + story « ${st.caption} »`);
    } catch (error) {
      failures++;
      console.log(`  ! story of @${creator.username}: ${error.message}`);
    }
  }
  for (const v of upload.filter((x) => !missing.includes(x))) {
    try {
      const file = path.join(mediaDir, v.file);
      const note = credit(runOf(v.file));
      const created = await call("/api/videos/create-upload-session", {
        method: "POST",
        body: JSON.stringify({
          title: v.title,
          description: `${v.description}${note ? `\n\n${note}` : ""}`,
          visibility: v.visibility ?? "PUBLIC",
          minTipAmountCents: v.minTipAmountCents ?? 0,
          tags: v.tags,
          sizeBytes: fs.statSync(file).size,
        }),
      });
      const body = await created.json();
      if (!created.ok) throw new Error(`session refused (${created.status}): ${body.error ?? ""}`);
      await sendOriginal(file, body.session);
      const ready = await waitReady(call, v.title);
      const shape = ready.height > ready.width ? "vertical" : "horizontal";
      console.log(`  + ${v.title} (${ready.width}x${ready.height}${shape === v.orientation ? "" : ` — expected ${v.orientation}!`})`);
      if (shape !== v.orientation) failures++;
      // A video whose thumbnail is missing or a flat frame would be an empty grey card in the feed: the seed fails on it.
      const details = await (await call(`/api/videos/${ready.id}/details`)).json().catch(() => ({}));
      const why = await problemOf(details.video?.thumbnailUrl);
      if (why) {
        failures++;
        console.log(`  ! ${v.title}: ${why}`);
      }
    } catch (error) {
      failures++;
      console.log(`  ! ${v.title}: ${error.message}`);
    }
  }
}
process.exit(failures ? 1 : 0);
