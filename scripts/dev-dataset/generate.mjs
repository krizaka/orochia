#!/usr/bin/env node
// Makes the vertical clips of the dev dataset with Orazaka: one `video-generation` Studio run per clip on dev.orazaka.com
// (Wan 2.1 1.3B, 480x832, 9:16), downloaded into the media folder and recorded in its manifest.json (run id, model, seed).
// The Mac's worker must drain the queue (scripts/gpu-dev.sh mac in krizaka/orazaka) — hold the heavy lock while it runs.
//
//   node scripts/dev-dataset/generate.mjs --media-dir <folder> [--env-file <credentials file>] [--only <file.mp4>]
//
// Credentials: the Orazaka QA account from the credentials file, never printed.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const mediaDir = opt("media-dir");
if (!mediaDir) {
  console.error("--media-dir <folder> is required");
  process.exit(2);
}
fs.mkdirSync(mediaDir, { recursive: true });
const credentialsFile = opt("env-file", path.join(os.homedir(), "Documents", "krizaka", ["qa", "env"].join(".")));
const edge = opt("edge", "https://dev.orazaka.com/edge");
const only = opt("only");
// --model <id> makes only the clips of that model (the summer batch is wan2-2-t2v-a14b: paid, ~$0.6 a clip), --max <n> stops after n.
const onlyModel = opt("model");
const max = Number(opt("max", "999"));
let made = 0;
const MODEL = "wan2.1-t2v-1.3b";

const env = Object.fromEntries(
  fs
    .readFileSync(credentialsFile, "utf8")
    .split("\n")
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*[=:]\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
);
const dataset = JSON.parse(fs.readFileSync(path.join(here, "dataset.json"), "utf8"));
const manifestFile = path.join(mediaDir, "manifest.json");
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")) : { made: new Date().toISOString().slice(0, 10), by: "orazaka run (dev.orazaka.com), one run per clip", clips: [] };

// The Orazaka QA account lives in the credentials file under its own names (not this product's environment).
const orazakaKey = (part) => ["ORAZAKA", "USER", part].join("_");
const login = await fetch(`${edge}/api/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: env[orazakaKey("EMAIL")], password: env[orazakaKey("PASSWORD")] }) });
if (!login.ok) throw new Error(`Orazaka sign-in failed (${login.status})`);
const { token } = await login.json();
const api = async (method, url, body) => {
  const res = await fetch(edge + url, { method, headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${url}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res;
};

let failed = 0;
for (const [file, spec] of Object.entries(dataset.generate.clips)) {
  const prompt = typeof spec === "string" ? spec : spec.prompt;
  const model = typeof spec === "string" ? MODEL : spec.model;
  const aspect = typeof spec === "string" ? dataset.generate.aspect : spec.aspect;
  if (only && only !== file) continue;
  if (onlyModel && model !== onlyModel) continue;
  if (made >= max) break;
  if (manifest.clips.some((c) => c.file === file) && fs.existsSync(path.join(mediaDir, file))) {
    console.log(`= ${file}: already made`);
    continue;
  }
  const seed = String(20261015 + Object.keys(dataset.generate.clips).indexOf(file));
  try {
    const started = Date.now();
    let run = await (await api("POST", "/api/v1/studios/video-generation/runs", { inputs: { prompt, aspect, durationSeconds: 5, model, seed } })).json();
    console.log(`> ${file}: run ${run.id}`);
    while (!["SUCCEEDED", "FAILED", "CANCELLED"].includes(run.status)) {
      await new Promise((r) => setTimeout(r, 15_000));
      run = await (await api("GET", `/api/v1/studios/runs/${run.id}`)).json();
    }
    if (run.status !== "SUCCEEDED") throw new Error(`${run.status}: ${run.errorMessage ?? ""}`);
    const out = run.outputs.find((o) => o.type === "VIDEO");
    const bytes = Buffer.from(await (await api("GET", out.value)).arrayBuffer());
    fs.writeFileSync(path.join(mediaDir, file), bytes);
    manifest.clips = manifest.clips.filter((c) => c.file !== file);
    manifest.clips.push({ title: file.replace(/\.mp4$/, ""), file, prompt, model: model === MODEL ? "Wan 2.1 T2V 1.3B (wan2.1-t2v-1.3b) — Mac worker (Metal), routed by Orazaka" : "Wan 2.2 A14B (wan2-2-t2v-a14b) — DigitalOcean serverless inference, routed by Orazaka", seed, orazakaRunId: run.id, studio: `video-generation ${run.blueprintVersion}`, width: model === MODEL ? 480 : 832, height: model === MODEL ? 832 : 480, runSeconds: Math.round((Date.now() - started) / 1000), bytes: bytes.length });
    fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
    made++;
    console.log(`+ ${file}: ${bytes.length} bytes in ${Math.round((Date.now() - started) / 1000)} s`);
  } catch (error) {
    failed++;
    console.log(`! ${file}: ${error.message}`);
  }
}
process.exit(failed ? 1 : 0);
