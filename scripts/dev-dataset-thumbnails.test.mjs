import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { isBlank, lumaStats, problemOf } from "./dev-dataset/thumbnails.mjs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "thumbtest-"));
const make = (name, filter) => {
  const file = path.join(dir, name);
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", filter, "-frames:v", "1", file]);
  return file;
};
const flat = make("flat.jpg", "color=c=0x1e1e1e:s=320x200");
const picture = make("picture.jpg", "testsrc=s=320x200");
const answer = (file, status = 200) => async () => ({ status, arrayBuffer: async () => fs.readFileSync(file) });

describe("a public video's thumbnail", () => {
  it("is blank when the frame is flat (the grey card of « Automation demo: morning PDFs »)", () => {
    expect(isBlank(lumaStats(flat))).toBe(true);
    expect(isBlank(lumaStats(picture))).toBe(false);
  });
  it("fails the check when missing, not found, or blank — passes with a real picture", async () => {
    expect(await problemOf(null)).toBe("no thumbnail");
    expect(await problemOf("https://x/t.jpg", answer(picture, 404))).toBe("thumbnail answers 404");
    expect(await problemOf("https://x/t.jpg", answer(flat))).toMatch(/^blank frame/);
    expect(await problemOf("https://x/t.jpg", answer(picture))).toBeNull();
  });
});
