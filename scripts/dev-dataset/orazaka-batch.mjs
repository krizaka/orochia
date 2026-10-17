#!/usr/bin/env node
// Makes the dataset's media THROUGH Orazaka: every picture is one `image-generation` Studio run, every clip one `video-generation`
// run started from an approved picture (Wan 2.2 TI2V 5B, 5 s). The jobs are the catalogue's (catalogue.mjs `buildJobs`), submitted as a
// batch with a bounded number in flight, so the generation is itself a load test of Orazaka's jobs, queue, worker and storage:
// every run's timings are recorded (queue = submit to start, run = start to finish) in <media>/state.json and <media>/events.jsonl.
//
//   node scripts/dev-dataset/orazaka-batch.mjs --media-dir <scratch folder> --phase images|clips [--only <id prefix>[,…]]
//        [--concurrency 4] [--max-minutes 120] [--redo <id,…>] [--variant <n>] [--edge https://dev.orazaka.com/edge] [--env-file <QA store>]
//
// Media never enters the repository. A clip is made only from a picture listed in <media>/review.json (`approved`), so a person has
// looked at it first (review.mjs builds the contact sheets). The Orazaka QA account is read from the QA store, never printed.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { buildJobs, CLIP, loadCatalogue, seedOf } from "./catalogue.mjs";
import { readEnv } from "./qa-store.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../apps/web/package.json"));
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const mediaDir = opt("media-dir");
const phase = opt("phase");
if (!mediaDir || !["images", "clips"].includes(phase)) {
  console.error("usage: orazaka-batch.mjs --media-dir <folder> --phase images|clips [--only a,b] [--concurrency 4] [--max-minutes 120]");
  process.exit(2);
}
const edge = opt("edge", "https://dev.orazaka.com/edge");
const only = opt("only")?.split(",").filter(Boolean);
const redo = new Set(opt("redo", "").split(",").filter(Boolean));
const concurrency = Number(opt("concurrency", "4"));
const deadline = Date.now() + Number(opt("max-minutes", "120")) * 60_000;
const variant = Number(opt("variant", "0"));
const storeFile = opt("env-file", path.join(os.homedir(), "Documents", "krizaka", ["qa", "env"].join(".")));
for (const d of ["images", "clips", "starts"]) fs.mkdirSync(path.join(mediaDir, d), { recursive: true });

const stateFile = path.join(mediaDir, "state.json");
const eventsFile = path.join(mediaDir, "events.jsonl");
const reviewFile = path.join(mediaDir, "review.json");
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : { jobs: {} };
const review = fs.existsSync(reviewFile) ? JSON.parse(fs.readFileSync(reviewFile, "utf8")) : { approved: [], rejected: {} };
const save = () => fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 1)}\n`);
const log = (event) => fs.appendFileSync(eventsFile, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
const fileOf = (job) => path.join(mediaDir, job.kind === "image" ? "images" : "clips", `${job.id.replaceAll("/", "__")}.${job.kind === "image" ? "png" : "mp4"}`);
const keyOf = (job) => `${job.kind}:${job.id}`;

const store = readEnv(storeFile);
const orazakaKey = (part) => ["ORAZAKA", "USER", part].join("_");
let token;
// The batch uses an Orazaka API key (`oz_…`, Authorization: Bearer) — the integration path the products use: edge exchange, per-key daily
// quota, metering. `--mint-key` creates one for the QA account (stored in the QA store, never printed).
async function login() {
  if (store.OROCHIA_DATASET_ORAZAKA_KEY && !args.includes("--mint-key") && !args.includes("--session")) {
    token = store.OROCHIA_DATASET_ORAZAKA_KEY;
    return;
  }
  const res = await fetch(`${edge}/api/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: store[orazakaKey("EMAIL")], password: store[orazakaKey("PASSWORD")] }) });
  if (!res.ok) throw new Error(`Orazaka sign-in failed (${res.status})`);
  token = (await res.json()).token;
}

/** One call, retried on a dropped socket or a 5xx; a 401 signs in again; a 4xx is an answer. */
async function call(method, route, body, { form, raw } = {}) {
  let last;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      stats.requests++;
      const res = await fetch(edge + route, {
        method,
        signal: AbortSignal.timeout(raw ? 300_000 : 60_000),
        headers: { Accept: "application/json", ...(form || body === undefined ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
      });
      if (res.status === 401 && attempt < 3) {
        await login();
        continue;
      }
      if (res.status === 429) stats.quota429++;
      if (!res.ok) {
        const refused = new Error(`${method} ${route} -> ${res.status} ${(await res.text()).slice(0, 300)}`);
        refused.status = res.status;
        refused.final = res.status < 500;
        throw refused;
      }
      return raw ? res : res.json();
    } catch (error) {
      last = error;
      if (error.final) break;
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
  throw last;
}

const cat = loadCatalogue(here);
let jobs = buildJobs(cat).filter((j) => (phase === "images" ? j.kind === "image" : j.kind === "clip"));
if (only) jobs = jobs.filter((j) => only.some((p) => j.id.startsWith(p)));

const finished = (rec) => rec?.status === "SUCCEEDED" && fs.existsSync(rec.file);
const todo = jobs.filter((j) => {
  const rec = state.jobs[keyOf(j)];
  if (redo.has(j.id)) return true;
  if (finished(rec)) return false;
  if (phase === "clips" && !review.approved.includes(j.from)) return false;
  return true;
});
console.log(`${phase}: ${jobs.length} in the catalogue, ${todo.length} to make, ${concurrency} in flight`);

async function prepareStart(job) {
  const sharp = require("sharp");
  const size = CLIP[job.orientation];
  const src = fileOf({ kind: "image", id: job.from });
  const out = path.join(mediaDir, "starts", `${job.id.replaceAll("/", "__")}.png`);
  await sharp(src).resize(size.width, size.height, { fit: "cover", position: "centre" }).png().toFile(out);
  return out;
}

async function submit(job, rec) {
  const seed = variant ? seedOf(job.id, variant) : job.seed;
  if (job.kind === "image") {
    return call("POST", "/api/v1/studios/image-generation/runs", { inputs: { prompt: job.prompt, size: job.size, seed, model: job.model } });
  }
  const start = await prepareStart(job);
  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(start)], { type: "image/png" }), path.basename(start));
  const uploaded = await call("POST", "/api/v1/media/upload", undefined, { form });
  rec.uploadId = uploaded.assetId ?? uploaded.id;
  return call("POST", "/api/v1/studios/video-generation/runs", { inputs: { prompt: job.prompt, durationSeconds: job.seconds, aspect: job.aspect, seed, model: job.model, image: rec.uploadId } });
}

/** One call refreshes every run in flight (the run-history list), not one call per run: the API-key quota counts requests. */
const live = new Map();
let lastList = 0;
let listing = null;
async function refreshRuns() {
  if (listing) return listing;
  listing = (async () => {
    try {
      const list = await call("GET", "/api/v1/studios/runs?size=200");
      for (const r of list) live.set(r.id, r);
      stats.listCalls++;
    } catch (error) {
      log({ event: "list-failed", message: error.message });
    } finally {
      lastList = Date.now();
      listing = null;
    }
  })();
  return listing;
}
const stats = { requests: 0, listCalls: 0, byIdCalls: 0, quota429: 0 };
const ACTIVE = new Set(["PENDING", "RUNNING", "QUEUED", "AWAITING_APPROVAL"]);
async function makeOne(job) {
  const key = keyOf(job);
  const prior = state.jobs[key];
  const rec = (prior && prior.runId && ACTIVE.has(prior.status) ? prior : { id: job.id, kind: job.kind, attempts: (prior?.attempts ?? 0) + 1 });
  state.jobs[key] = rec;
  if (!rec.runId) {
    rec.submittedAt = Date.now();
    rec.seed = variant ? seedOf(job.id, variant) : job.seed;
    rec.model = job.model;
    const run = await submit(job, rec);
    rec.runId = run.id;
    rec.status = run.status ?? "PENDING";
    save();
    log({ event: "submitted", key, runId: rec.runId });
  }
  let run = { status: rec.status };
  while (ACTIVE.has(run.status)) {
    if (Date.now() > deadline + 30 * 60_000) throw new Error("gave up waiting (deadline)");
    await new Promise((r) => setTimeout(r, job.kind === "image" ? 4000 : 10000));
    if (Date.now() - lastList > 8000) await refreshRuns();
    else if (listing) await listing;
    run = live.get(rec.runId) ?? run;
    if (!live.has(rec.runId) && Date.now() - rec.submittedAt > 120_000) {
      try {
        stats.byIdCalls++;
        run = await call("GET", `/api/v1/studios/runs/${rec.runId}`);
      } catch (error) {
        log({ event: "poll-failed", key, message: error.message });
      }
    }
    if (run.startedAt && !rec.startedAt) rec.startedAt = Date.parse(run.startedAt);
  }
  rec.status = run.status;
  rec.startedAt = run.startedAt ? Date.parse(run.startedAt) : rec.startedAt;
  rec.finishedAt = run.finishedAt ? Date.parse(run.finishedAt) : Date.now();
  rec.queueS = rec.startedAt ? Math.round((rec.startedAt - rec.submittedAt) / 1000) : null;
  rec.runS = rec.startedAt ? Math.round((rec.finishedAt - rec.startedAt) / 1000) : null;
  rec.totalS = Math.round((rec.finishedAt - rec.submittedAt) / 1000);
  for (const o of run.outputs ?? []) if (o.type === "TEXT") rec[o.key] = o.value;
  if (run.status !== "SUCCEEDED") {
    rec.error = run.errorMessage ?? run.status;
    log({ event: "failed", key, error: rec.error });
    save();
    return;
  }
  const output = (run.outputs ?? []).find((o) => ["IMAGE", "VIDEO"].includes(o.type)) ?? run.outputs?.find((o) => String(o.value).startsWith("/api/"));
  const res = await call("GET", output.value, undefined, { raw: true });
  const data = Buffer.from(await res.arrayBuffer());
  if (data.length < (job.kind === "image" ? 5_000 : 50_000)) throw new Error(`${job.id}: ${data.length} bytes is not a ${job.kind}`);
  rec.file = fileOf(job);
  fs.writeFileSync(rec.file, data);
  rec.bytes = data.length;
  rec.studio = `${job.kind === "image" ? "image-generation" : "video-generation"} ${run.blueprintVersion}`;
  delete rec.error;
  log({ event: "done", key, queueS: rec.queueS, runS: rec.runS });
  save();
  const mark = job.kind === "clip" ? ` ${rec.bytes} B` : "";
  console.log(`+ ${job.id} ${job.kind} queue ${rec.queueS}s run ${rec.runS}s${mark}`);
}

if (args.includes("--mint-key")) {
  await login();
  const made = await call("POST", "/api/v1/api-keys", { name: "orochia-dev-dataset-batch", scopes: [] });
  const key = made.key ?? made.apiKey ?? made.token ?? made.value;
  if (!key) throw new Error(`no key in the answer (fields: ${Object.keys(made)})`);
  (await import("./qa-store.mjs")).setQaEnv(storeFile, { OROCHIA_DATASET_ORAZAKA_KEY: key });
  console.log("API key minted into the QA store");
  process.exit(0);
}
await login();
let next = 0;
let failed = 0;
async function worker() {
  while (next < todo.length && Date.now() < deadline) {
    const job = todo[next++];
    try {
      await makeOne(job);
      if (state.jobs[keyOf(job)]?.status !== "SUCCEEDED") {
        failed++;
        console.log(`! ${job.id}: ${state.jobs[keyOf(job)]?.error}`);
      }
    } catch (error) {
      failed++;
      const rec = (state.jobs[keyOf(job)] ??= { id: job.id, kind: job.kind });
      rec.status = "ERROR";
      rec.error = error.message;
      log({ event: "error", key: keyOf(job), message: error.message });
      save();
      console.log(`! ${job.id}: ${error.message}`);
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
save();
log({ event: "api-calls", ...stats });
console.log(`${phase}: ${stats.listCalls} run-list calls, ${stats.byIdCalls} by-id calls; done, ${failed} failed, ${todo.length - next > 0 ? `${todo.length - next} left (deadline)` : "none left"}`);
process.exit(failed ? 1 : 0);
