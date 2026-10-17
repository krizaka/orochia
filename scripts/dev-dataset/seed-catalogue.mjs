#!/usr/bin/env node
// Seeds the catalogue's creators through Orochia's PUBLIC API, signed in as each creator — never SQL (accounts.mjs opens the accounts).
// Idempotent: it creates what is missing, keeps what matches (profile media once, videos by title, collections by title).
//
//   node scripts/dev-dataset/seed-catalogue.mjs --media-dir <folder with state.json and review.json> --phase profiles|videos|collections|stories|all
//        [--base https://dev.orochia.com] [--env-file <QA store>] [--only <creator key>[,…]] [--dry-run] [--max-videos <n>]
//
// Only items the quality gate approved are sent (review.json: a still `approved`, a clip `clip:<id>` approved). Stories live 24 hours:
// run the `stories` phase last, and again to refresh them.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { loadCatalogue, slug } from "./catalogue.mjs";
import { credentialsOf, listOwn, sendOriginal, signIn } from "./orochia-client.mjs";
import { readEnv } from "./qa-store.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../apps/web/package.json"));
const sharp = require("sharp");
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const mediaDir = opt("media-dir");
if (!mediaDir) throw new Error("--media-dir <folder> is required");
const base = opt("base", "https://dev.orochia.com").replace(/\/$/, "");
const phase = opt("phase", "all");
const only = opt("only")?.split(",").filter(Boolean);
const dry = args.includes("--dry-run");
const maxVideos = Number(opt("max-videos", "9999"));
const store = readEnv(opt("env-file", path.join(os.homedir(), "Documents", "krizaka", ["qa", "env"].join("."))));
const state = JSON.parse(fs.readFileSync(path.join(mediaDir, "state.json"), "utf8"));
const review = JSON.parse(fs.readFileSync(path.join(mediaDir, "review.json"), "utf8"));
const seedFile = path.join(mediaDir, "seed-state.json");
const seeded = fs.existsSync(seedFile) ? JSON.parse(fs.readFileSync(seedFile, "utf8")) : { profile: {}, videos: {}, storiesAt: {} };
const saveSeed = () => fs.writeFileSync(seedFile, `${JSON.stringify(seeded, null, 1)}\n`);
const cat = loadCatalogue(here);
const phases = phase === "all" ? ["profiles", "videos", "collections", "stories"] : [phase];

const made = (kind, id) => {
  const rec = state.jobs[`${kind}:${id}`];
  return rec?.status === "SUCCEEDED" && rec.file && fs.existsSync(rec.file) ? rec : null;
};
const stillApproved = (id) => review.approved.includes(id) && made("image", id);
const clipApproved = (id) => review.approved.includes(`clip:${id}`) && made("clip", id);
let failures = 0;
const fail = (message) => {
  failures++;
  console.log(`  ! ${message}`);
};

async function uploadImage(call, category, buffer, name) {
  const form = new FormData();
  form.set("category", category);
  form.set("file", new Blob([buffer], { type: "image/webp" }), name);
  const res = await call("/api/uploads", { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`upload ${category} refused (${res.status}) ${body.error ?? ""}`);
  return body.data.ref;
}

async function profiles(c, call) {
  const marker = seeded.profile[c.key] ?? {};
  const bio = c.existing ? undefined : `${c.bio}\n\n${c.tags.map((t) => `#${t.replaceAll("-", "")}`).join(" ")}`;
  const body = { displayName: c.displayName, ...(bio ? { bio } : {}) };
  const avatar = made("image", `${c.key}/avatar`);
  const banner = made("image", `${c.key}/banner`);
  if (review.approved.includes(`${c.key}/avatar`) && avatar && !marker.avatar) body.avatar = await uploadImage(call, "avatars", await sharp(avatar.file).resize(512, 512).webp({ quality: 88 }).toBuffer(), "avatar.webp");
  if (review.approved.includes(`${c.key}/banner`) && banner && !marker.banner) body.banner = await uploadImage(call, "banners", await sharp(banner.file).resize(1600, 400, { fit: "cover", position: "centre" }).webp({ quality: 86 }).toBuffer(), "banner.webp");
  const res = await call("/api/me/profile", { method: "PUT", body: JSON.stringify(body) });
  if (!res.ok) return fail(`profile refused (${res.status}) ${(await res.text()).slice(0, 160)}`);
  seeded.profile[c.key] = { avatar: marker.avatar || Boolean(body.avatar), banner: marker.banner || Boolean(body.banner) };
  saveSeed();
  console.log(`  profile set${body.avatar ? " + avatar" : ""}${body.banner ? " + banner" : ""}`);
}

async function videos(c, call) {
  const have = await listOwn(call);
  const wanted = c.videos.filter((v) => !have.some((h) => h.title.toLowerCase() === v.title.toLowerCase()) && clipApproved(`${c.key}/v/${slug(v.title)}`));
  console.log(`  videos: ${have.length} now, ${wanted.length} to send`);
  for (const v of wanted) {
    if (seeded.sent >= maxVideos) break;
    const id = `${c.key}/v/${slug(v.title)}`;
    const file = made("clip", id).file;
    const note = `Made with Orazaka — run ${made("clip", id).runId} (${made("clip", id).model}${made("image", id) && !made("clip", id).model?.includes("t2v") ? `, from a FLUX.2 [klein] picture, run ${made("image", id).runId}` : ""}).`;
    try {
      if (dry) {
        console.log(`  + ${v.title} (dry)`);
        continue;
      }
      const created = await call("/api/videos/create-upload-session", {
        method: "POST",
        body: JSON.stringify({ title: v.title, description: `${v.description}\n\n${note}`, visibility: v.visibility ?? "PUBLIC", minTipAmountCents: v.minTipCents ?? 0, tags: v.tags, sizeBytes: fs.statSync(file).size, ...(c.rating ? { contentRatingId: c.rating } : {}) }),
      });
      const body = await created.json();
      if (!created.ok) throw new Error(`session refused (${created.status}): ${body.error ?? JSON.stringify(body).slice(0, 120)}`);
      await sendOriginal(file, body.session);
      seeded.sent = (seeded.sent ?? 0) + 1;
      seeded.videos[id] = { sentAt: new Date().toISOString() };
      saveSeed();
      console.log(`  + ${v.title}`);
    } catch (error) {
      fail(`${v.title}: ${error.message}`);
    }
  }
}

async function collections(c, call) {
  const own = await listOwn(call);
  const readyByTitle = new Map(own.filter((v) => v.width).map((v) => [v.title.toLowerCase(), v.id]));
  const mine = (await (await call("/api/playlists")).json()).playlists ?? [];
  for (const col of c.collections ?? []) {
    const ids = col.videos.map((t) => readyByTitle.get(t.toLowerCase())).filter(Boolean);
    if (!ids.length) continue;
    let playlist = mine.find((p) => p.title === col.title);
    if (!playlist && !dry) {
      const res = await call("/api/playlists", { method: "POST", body: JSON.stringify({ title: col.title, description: col.description, visibility: "PUBLIC" }) });
      if (!res.ok) {
        fail(`collection "${col.title}" refused (${res.status})`);
        continue;
      }
      playlist = (await res.json()).playlist;
    }
    if (!playlist) continue;
    for (const videoId of ids) {
      const res = await call(`/api/playlists/${playlist.id}/items`, { method: "POST", body: JSON.stringify({ videoId }) });
      if (!res.ok) fail(`collection "${col.title}": item refused (${res.status})`);
    }
    console.log(`  collection "${col.title}": ${ids.length}/${col.videos.length} videos`);
  }
}

async function stories(c, call) {
  const done = [];
  for (let i = 0; i < c.stories.length; i++) {
    const s = c.stories[i];
    const id = `${c.key}/s/${i + 1}`;
    if (!stillApproved(id)) continue;
    try {
      if (s.kind === "clip" && clipApproved(id)) {
        const file = made("clip", id).file;
        const res = await call("/api/stories/upload-session", { method: "POST", body: JSON.stringify({ caption: s.caption, audience: "PUBLIC", sizeBytes: fs.statSync(file).size, durationSeconds: 5 }) });
        const body = await res.json();
        if (!res.ok) throw new Error(`clip story refused (${res.status}) ${body.error ?? ""}`);
        await sendOriginal(file, body.session);
      } else {
        const ref = await uploadImage(call, "stories", await sharp(made("image", id).file).resize(768, 1360).webp({ quality: 86 }).toBuffer(), "story.webp");
        const res = await call("/api/stories", { method: "POST", body: JSON.stringify({ imageRef: ref, caption: s.caption, audience: "PUBLIC", ...(c.rating ? { contentRatingId: c.rating } : {}) }) });
        if (!res.ok) throw new Error(`story refused (${res.status}) ${(await res.text()).slice(0, 120)}`);
      }
      done.push(id);
    } catch (error) {
      fail(`${id}: ${error.message}`);
    }
  }
  seeded.storiesAt[c.key] = new Date().toISOString();
  saveSeed();
  console.log(`  stories: ${done.length}/${c.stories.length}`);
}

for (const c of cat.creators) {
  if (only && !only.includes(c.key)) continue;
  console.log(`\n${c.displayName} (@${c.username})`);
  let call;
  try {
    call = await signIn(base, credentialsOf(c, store));
  } catch (error) {
    fail(error.message);
    continue;
  }
  if (c.existing) await call("/api/me/become-creator", { method: "POST" });
  for (const p of phases) {
    try {
      if (p === "profiles") await profiles(c, call);
      if (p === "videos") await videos(c, call);
      if (p === "collections") await collections(c, call);
      if (p === "stories") await stories(c, call);
    } catch (error) {
      fail(`${p}: ${error.message}`);
    }
  }
}
console.log(`\nseed: ${failures} problem(s)`);
process.exit(failures ? 1 : 0);
