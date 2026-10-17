#!/usr/bin/env node
// Makes Orochia's default avatars (512 and 256 webp) and banners (1600x400 webp) with Orazaka: one `image-generation`
// Studio run per image on dev.orazaka.com (FLUX.2 [klein], the Mac worker's sd-server), converted with sharp, written
// under <out>/avatars and <out>/banners with a manifest.json (run id, model, seed, prompt) and a contact sheet.
//
//   node scripts/dev-dataset/generate-profile-media.mjs --out ~/.krizaka-worktrees/oro-profile-media [--only <id>] [--spec profile-media-v2.json]
//
// profile-media.json is the first batch (banners 4:1, one 1600 file); a spec whose name ends in -v2.json is the second:
// banners are made at 1536x512 (3:1) and written at 1600 (`<id>.webp`) and 800 (`<id>-800.webp`). Every item of a v2 spec
// is a CANDIDATE: review contact-avatars.png / contact-banners.png, keep the best, add them to apps/web/lib/presets.manifest.json.
// The one RunPod pod is shared (runpod-guard.py status): never start a second one for this.
//
// Needs the Mac worker on the queue (heavy lock). Credentials: the Orazaka QA account from the credentials file.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../package.json"));
const sharp = require("sharp");
const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const out = opt("out");
if (!out) {
  console.error("--out <folder> is required");
  process.exit(2);
}
const only = opt("only");
const edge = opt("edge", "https://dev.orazaka.com/edge");
// --direct http://127.0.0.1:18086: talk to the pod's sd-server (FLUX.2 [klein], the very engine the Studio routes to) through an ssh
// tunnel, without the Orazaka core: for when the platform's billing/runs API is down. The run ids of the manifest are then null.
const direct = opt("direct");
const credentialsFile = opt("env-file", path.join(os.homedir(), "Documents", "krizaka", ["qa", "env"].join(".")));
const env = Object.fromEntries(
  fs
    .readFileSync(credentialsFile, "utf8")
    .split("\n")
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*[=:]\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
);
const specFile = opt("spec", "profile-media.json");
const wide = specFile.endsWith("-v2.json");
const spec = JSON.parse(fs.readFileSync(path.join(here, specFile), "utf8"));
for (const d of ["avatars", "banners", "raw"]) fs.mkdirSync(path.join(out, d), { recursive: true });
const manifestFile = path.join(out, wide ? "manifest-v2.json" : "manifest.json");
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")) : { by: "orazaka image-generation (dev.orazaka.com)", items: [] };

// The Orazaka QA account lives in the credentials file under its own names (not this product's environment).
const orazakaKey = (part) => ["ORAZAKA", "USER", part].join("_");
const login = direct ? { ok: true, json: async () => ({ token: "" }) } : await fetch(`${edge}/api/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: env[orazakaKey("EMAIL")], password: env[orazakaKey("PASSWORD")] }) });
if (!login.ok) throw new Error(`Orazaka sign-in failed (${login.status})`);
const { token } = await login.json();
const api = async (method, url, body) => {
  const res = await fetch(edge + url, { method, headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${url}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res;
};

const jobs = [
  ...spec.avatars.map((a) => ({ kind: "avatar", ...a, size: "1024x1024" })),
  ...spec.banners.map((b) => ({ kind: "banner", ...b, size: wide ? "1536x512" : "1360x768" })),
];
async function save(job, raw, seed, runId, studio, started) {
  fs.writeFileSync(path.join(out, "raw", `${job.id}.png`), raw);
  if (job.kind === "avatar") {
    for (const px of [512, 256]) await sharp(raw).resize(px, px).webp({ quality: 88 }).toFile(path.join(out, "avatars", `${job.id}-${px}.webp`));
  } else if (wide) {
    await sharp(raw).resize(1600, 533, { fit: "cover", position: "centre" }).webp({ quality: 86 }).toFile(path.join(out, "banners", `${job.id}.webp`));
    await sharp(raw).resize(800, 267, { fit: "cover", position: "centre" }).webp({ quality: 84 }).toFile(path.join(out, "banners", `${job.id}-800.webp`));
  } else {
    await sharp(raw).resize(1600, 400, { fit: "cover", position: "centre" }).webp({ quality: 86 }).toFile(path.join(out, "banners", `${job.id}.webp`));
  }
  manifest.items.push({ id: job.id, kind: job.kind, style: job.family ?? job.style ?? null, prompt: job.prompt, seed, orazakaRunId: runId, studio, runSeconds: Math.round((Date.now() - started) / 1000) });
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`+ ${job.id} (${Math.round((Date.now() - started) / 1000)} s)`);
}

let failed = 0;
let n = 0;
for (const job of jobs) {
  n++;
  if (only && only !== job.id) continue;
  if (manifest.items.some((i) => i.id === job.id)) {
    console.log(`= ${job.id}: already made`);
    continue;
  }
  const seed = String((wide ? 20262100 : 20261100) + n);
  try {
    const started = Date.now();
    if (direct) {
      const [w, h] = job.size.split("x");
      const res = await fetch(`${direct}/v1/images/generations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: `${job.prompt}. ${spec.style}<sd_cpp_extra_args>{"seed":${seed}}</sd_cpp_extra_args>`, n: 1, size: `${w}x${h}`, response_format: "b64_json" }) });
      if (!res.ok) throw new Error(`sd-server HTTP ${res.status}`);
      const raw = Buffer.from((await res.json()).data[0].b64_json, "base64");
      await save(job, raw, seed, null, `sd-server flux-2-klein-4b (direct)`, started);
      continue;
    }
    let run = await (await api("POST", "/api/v1/studios/image-generation/runs", { inputs: { prompt: `${job.prompt}. ${spec.style}`, size: job.size, seed } })).json();
    while (!["SUCCEEDED", "FAILED", "CANCELLED"].includes(run.status)) {
      await new Promise((r) => setTimeout(r, 8_000));
      run = await (await api("GET", `/api/v1/studios/runs/${run.id}`)).json();
    }
    if (run.status !== "SUCCEEDED") throw new Error(`${run.status}: ${run.errorMessage ?? ""}`);
    const image = run.outputs.find((o) => o.type === "IMAGE") ?? run.outputs[0];
    const raw = Buffer.from(await (await api("GET", image.value)).arrayBuffer());
    await save(job, raw, seed, run.id, `image-generation ${run.blueprintVersion}`, started);
  } catch (error) {
    failed++;
    console.log(`! ${job.id}: ${error.message}`);
  }
}

// The contact sheet, for review before anything is wired.
const avatars = manifest.items.filter((i) => i.kind === "avatar");
if (avatars.length) {
  const cell = 256;
  const cols = 4;
  const rows = Math.ceil(avatars.length / cols);
  await sharp({ create: { width: cols * cell, height: rows * cell, channels: 3, background: "#1a1326" } })
    .composite(avatars.map((a, i) => ({ input: path.join(out, "avatars", `${a.id}-256.webp`), left: (i % cols) * cell, top: Math.floor(i / cols) * cell })))
    .png()
    .toFile(path.join(out, "contact-avatars.png"));
}
const banners = manifest.items.filter((i) => i.kind === "banner");
if (banners.length) {
  const bw = 800;
  const bh = 200;
  await sharp({ create: { width: 2 * bw, height: Math.ceil(banners.length / 2) * bh, channels: 3, background: "#1a1326" } })
    .composite(
      await Promise.all(banners.map(async (b, i) => ({ input: await sharp(path.join(out, "banners", `${b.id}.webp`)).resize(bw, bh).png().toBuffer(), left: (i % 2) * bw, top: Math.floor(i / 2) * bh }))),
    )
    .png()
    .toFile(path.join(out, "contact-banners.png"));
}
process.exit(failed ? 1 : 0);
