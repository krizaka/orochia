// A public video's thumbnail must exist (200) and show something: a flat frame (a slate, a black intro) is an empty
// grey card in the feed. The measure is ffmpeg's signalstats on the luma: a picture whose brightest and darkest pixels
// are close is blank (the real picture of a clip always has a spread, even a dark one).
//
//   node scripts/dev-dataset/thumbnails.mjs [--base https://dev.orochia.com]     fails (exit 1) on any blank or missing thumbnail
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// @fixed: the luma spread (0-255) under which a frame is flat — a measured threshold of the picture, not a business setting.
export const MIN_SPREAD = 40;

/** From signalstats (`ylow`, `yhigh` of the luma): the frame is blank when its darkest and brightest pixels are close. */
export const isBlank = ({ ylow, yhigh }) => yhigh - ylow < MIN_SPREAD;

export function lumaStats(file) {
  const out = execFileSync("ffmpeg", ["-loglevel", "error", "-i", file, "-vf", "signalstats,metadata=print:file=-", "-f", "null", "-"], { encoding: "utf8" });
  const read = (k) => Number(new RegExp(`lavfi.signalstats.${k}=([0-9.]+)`).exec(out)?.[1]);
  return { ylow: read("YLOW"), yhigh: read("YHIGH"), yavg: read("YAVG") };
}

/** One thumbnail URL → `null` when it is fine, else why not. */
export async function problemOf(url, fetchImpl = fetch) {
  if (!url) return "no thumbnail";
  const res = await fetchImpl(url);
  if (res.status !== 200) return `thumbnail answers ${res.status}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "thumb-"));
  const file = path.join(dir, "t.jpg");
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  try {
    const stats = lumaStats(file);
    return isBlank(stats) ? `blank frame (luma ${stats.ylow}-${stats.yhigh})` : null;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const base = (process.argv.includes("--base") ? process.argv[process.argv.indexOf("--base") + 1] : "https://dev.orochia.com").replace(/\/$/, "");
  const sections = (await (await fetch(`${base}/api/explore`)).json()).sections ?? {};
  const seen = new Map();
  for (const list of Object.values(sections)) for (const v of list ?? []) if (v?.id && v.thumbnailUrl !== undefined) seen.set(v.id, v);
  let bad = 0;
  for (const v of seen.values()) {
    const why = await problemOf(v.thumbnailUrl);
    if (why) {
      bad++;
      console.log(`✗ ${v.title} (@${v.creatorUsername}): ${why}`);
    }
  }
  console.log(`${seen.size - bad}/${seen.size} thumbnails show a picture`);
  process.exit(bad ? 1 : 0);
}
