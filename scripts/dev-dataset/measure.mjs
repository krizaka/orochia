#!/usr/bin/env node
// What the dataset batch measured about Orazaka: counts, failures, queue and run times (p50/p95), throughput, cost per asset.
//
//   node scripts/dev-dataset/measure.mjs --media-dir <folder> [--gpu-usd <spent on pods>]
//
// Times are the platform's own clocks (a run's startedAt/finishedAt) against the batch's submit time: queue = submit to start, run = start to finish.
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const mediaDir = opt("media-dir");
const gpuUsd = Number(opt("gpu-usd", "0"));
const state = JSON.parse(fs.readFileSync(path.join(mediaDir, "state.json"), "utf8"));
const events = fs.existsSync(path.join(mediaDir, "events.jsonl")) ? fs.readFileSync(path.join(mediaDir, "events.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];

export const pct = (values, p) => {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.min(v.length - 1, Math.ceil((p / 100) * v.length) - 1)];
};

const out = {};
for (const kind of ["image", "clip"]) {
  const jobs = Object.values(state.jobs).filter((j) => j.kind === kind);
  const ok = jobs.filter((j) => j.status === "SUCCEEDED");
  const bad = jobs.filter((j) => j.status !== "SUCCEEDED");
  const stamps = jobs.filter((j) => j.submittedAt && j.finishedAt);
  const span = stamps.length ? (Math.max(...stamps.map((j) => j.finishedAt)) - Math.min(...stamps.map((j) => j.submittedAt))) / 3600_000 : 0;
  out[kind] = {
    runs: jobs.length,
    succeeded: ok.length,
    failed: bad.length,
    retried: jobs.filter((j) => j.attempts > 1).length,
    queueS: { p50: pct(ok.map((j) => j.queueS), 50), p95: pct(ok.map((j) => j.queueS), 95) },
    runS: { p50: pct(ok.map((j) => j.runS), 50), p95: pct(ok.map((j) => j.runS), 95), mean: ok.length ? Math.round(ok.reduce((a, j) => a + (j.runS ?? 0), 0) / ok.length) : null },
    spanHours: Number(span.toFixed(2)),
    perHour: span ? Number((ok.length / span).toFixed(1)) : null,
    errors: Object.entries(bad.reduce((m, j) => ((m[(j.error ?? "?").slice(0, 90)] = (m[(j.error ?? "?").slice(0, 90)] ?? 0) + 1), m), {})),
    bytes: ok.reduce((a, j) => a + (j.bytes ?? 0), 0),
  };
}
out.events = events.reduce((m, e) => ((m[e.event] = (m[e.event] ?? 0) + 1), m), {});
out.gpuUsd = gpuUsd;
const made = out.image.succeeded + out.clip.succeeded;
out.costPerAssetUsd = made && gpuUsd ? Number((gpuUsd / made).toFixed(3)) : null;
out.costPerClipUsd = out.clip.succeeded && gpuUsd ? Number(((gpuUsd * 0.88) / out.clip.succeeded).toFixed(3)) : null;
console.log(JSON.stringify(out, null, 1));
