#!/usr/bin/env node
// The quality gate of the dataset: contact sheets for a person to look at, and the verdicts they leave in <media>/review.json.
//
//   node scripts/dev-dataset/review.mjs sheets images|clips --media-dir <folder> [--only <id prefix>[,…]] [--per-sheet 15]
//   node scripts/dev-dataset/review.mjs approve --media-dir <folder> <id>…        (or `all` for every made, not yet judged item)
//   node scripts/dev-dataset/review.mjs reject  --media-dir <folder> <id>… --reason "…"
//
// Sheets are written under <media>/sheets/ with a numbered grid and a legend (number -> id) on stdout. Nothing leaves the folder.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../apps/web/package.json"));
const sharp = require("sharp");
const [command, ...rest] = process.argv.slice(2);
const args = rest;
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const mediaDir = opt("media-dir");
if (!mediaDir) throw new Error("--media-dir is required");
const state = JSON.parse(fs.readFileSync(path.join(mediaDir, "state.json"), "utf8"));
const reviewFile = path.join(mediaDir, "review.json");
const review = fs.existsSync(reviewFile) ? JSON.parse(fs.readFileSync(reviewFile, "utf8")) : { approved: [], rejected: {} };
const saveReview = () => fs.writeFileSync(reviewFile, `${JSON.stringify(review, null, 1)}\n`);
const ids = args.filter((a, i) => !a.startsWith("--") && !(args[i - 1] ?? "").startsWith("--"));

const made = (kind) => Object.values(state.jobs).filter((j) => j.kind === kind && j.status === "SUCCEEDED" && j.file && fs.existsSync(j.file));
const ns = opt("kind", "image") === "clip" || args[0] === "clips" ? "clip:" : "";
const judged = (id) => review.approved.includes(ns + id) || (ns + id) in review.rejected;

if (command === "approve" || command === "reject") {
  const targets = ids[0] === "all" ? made(ns ? "clip" : "image").map((j) => j.id).filter((id) => !judged(id)) : ids;
  for (const raw of targets) {
    const id = ns + raw;
    if (command === "approve") {
      review.approved = [...new Set([...review.approved, id])];
      delete review.rejected[id];
    } else {
      review.approved = review.approved.filter((x) => x !== id);
      review.rejected[id] = opt("reason", "rejected");
    }
  }
  saveReview();
  console.log(`${command}: ${targets.length} item(s); ${review.approved.length} approved, ${Object.keys(review.rejected).length} rejected`);
} else if (command === "sheets") {
  const kind = args[0] === "clips" ? "clip" : "image";
  const only = opt("only")?.split(",").filter(Boolean);
  let items = made(kind).filter((j) => !only || only.some((p) => j.id.startsWith(p)));
  if (!args.includes("--all")) items = items.filter((j) => !judged(j.id));
  items.sort((a, b) => a.id.localeCompare(b.id));
  const per = Number(opt("per-sheet", kind === "image" ? "15" : "6"));
  fs.mkdirSync(path.join(mediaDir, "sheets"), { recursive: true });
  const cell = kind === "image" ? { w: 300, h: 300 } : { w: 220, h: 300 };
  const cols = kind === "image" ? 5 : 3;
  const frames = kind === "image" ? 1 : 3;
  const label = (n) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="46" height="30"><rect width="46" height="30" fill="#000" fill-opacity="0.75"/><text x="23" y="21" font-family="Helvetica" font-size="18" font-weight="bold" fill="#fff" text-anchor="middle">${n}</text></svg>`);
  for (let s = 0; s * per < items.length; s++) {
    const chunk = items.slice(s * per, (s + 1) * per);
    const rows = Math.ceil(chunk.length / cols);
    const W = cols * cell.w * (kind === "clip" ? 1 : 1);
    const comps = [];
    for (let i = 0; i < chunk.length; i++) {
      const j = chunk[i];
      const left = (i % cols) * cell.w;
      const top = Math.floor(i / cols) * (kind === "image" ? cell.h : cell.h);
      let tile;
      if (kind === "image") {
        tile = await sharp(j.file).resize(cell.w - 4, cell.h - 4, { fit: "contain", background: "#222" }).toBuffer();
        comps.push({ input: tile, left: left + 2, top: top + 2 });
      } else {
        // three frames side by side inside one cell: first, middle, last
        const dir = fs.mkdtempSync(path.join(mediaDir, "sheets", "fr-"));
        const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", j.file]).toString().trim() || "5");
        const w3 = Math.floor((cell.w - 4) / 1);
        const strip = [];
        for (let f = 0; f < frames; f++) {
          const out = path.join(dir, `f${f}.png`);
          execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String((dur * (f === 0 ? 0.02 : f === 1 ? 0.5 : 0.97)).toFixed(2)), "-i", j.file, "-frames:v", "1", out]);
          strip.push(await sharp(out).resize(Math.floor(w3 / 1), Math.floor((cell.h - 4) / frames), { fit: "cover" }).toBuffer());
        }
        // vertical stack of the 3 frames, each cropped to a third of the cell height
        for (let f = 0; f < frames; f++) comps.push({ input: strip[f], left: left + 2, top: top + 2 + f * Math.floor((cell.h - 4) / frames) });
        fs.rmSync(dir, { recursive: true, force: true });
      }
      comps.push({ input: label(i + 1), left: left + 2, top: top + 2 });
    }
    const sheet = path.join(mediaDir, "sheets", `${kind}s-${String(s + 1).padStart(2, "0")}.jpg`);
    await sharp({ create: { width: W, height: rows * cell.h, channels: 3, background: "#111" } }).composite(comps).jpeg({ quality: 82 }).toFile(sheet);
    console.log(`\n${sheet}`);
    chunk.forEach((j, i) => console.log(`${String(i + 1).padStart(2)}  ${j.id}`));
  }
  if (!items.length) console.log("nothing to review");
} else {
  console.error("usage: review.mjs sheets images|clips | approve | reject");
  process.exit(2);
}
