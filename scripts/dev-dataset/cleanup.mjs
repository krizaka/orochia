#!/usr/bin/env node
// Removes the dataset from a deployment, through the same public API that made it (what a creator may delete in the app): the catalogue's
// videos (Bunny assets go with them), collections and stories. With --accounts (after this), accounts.mjs --remove drops the accounts.
//
//   node scripts/dev-dataset/cleanup.mjs [--base https://dev.orochia.com] [--env-file <QA store>] [--only <creator key>[,…]] [--dry-run]
//
// A video in an auction or delivered to a challenge cannot be deleted (the app refuses): it is reported and left.
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadCatalogue } from "./catalogue.mjs";
import { credentialsOf, listOwn, signIn } from "./orochia-client.mjs";
import { readEnv } from "./qa-store.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const base = opt("base", "https://dev.orochia.com").replace(/\/$/, "");
const only = opt("only")?.split(",").filter(Boolean);
const dry = args.includes("--dry-run");
const store = readEnv(opt("env-file", path.join(os.homedir(), "Documents", "krizaka", ["qa", "env"].join("."))));
const cat = loadCatalogue(here);
let kept = 0;
let removed = 0;
for (const c of cat.creators) {
  if (only && !only.includes(c.key)) continue;
  const titles = new Set(c.videos.map((v) => v.title.toLowerCase()));
  const call = await signIn(base, credentialsOf(c, store));
  for (const v of (await listOwn(call)).filter((x) => titles.has(x.title.toLowerCase()))) {
    if (dry) {
      console.log(`- ${c.key}: ${v.title} (dry)`);
      continue;
    }
    const res = await call(`/api/videos/${v.id}`, { method: "DELETE" });
    if (res.ok) removed++;
    else {
      kept++;
      console.log(`  kept ${v.title}: ${res.status} ${(await res.json().catch(() => ({}))).error ?? ""}`);
    }
  }
  const lists = (await (await call("/api/playlists")).json()).playlists ?? [];
  for (const p of lists.filter((x) => (c.collections ?? []).some((col) => col.title === x.title))) if (!dry) await call(`/api/playlists/${p.id}`, { method: "DELETE" });
  const mine = await (await call("/api/me/stories")).json().catch(() => ({}));
  for (const s of mine.stories ?? mine.items ?? []) if (!dry) await call(`/api/stories/${s.id}`, { method: "DELETE" });
  console.log(`${c.key}: done`);
}
console.log(`cleanup: ${removed} video(s) removed, ${kept} kept`);
