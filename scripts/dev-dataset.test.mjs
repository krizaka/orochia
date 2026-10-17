import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { credit, diffCreator, isUpgrade, validateDataset } from "./dev-dataset/plan.mjs";

const dataset = JSON.parse(readFileSync(new URL("./dev-dataset/dataset.json", import.meta.url), "utf8"));

describe("the dev dataset", () => {
  it("is curated: distinct footage and titles, prompts without faces", () => {
    expect(validateDataset(dataset)).toEqual([]);
  });
  it("catches the duplicates it exists to prevent", () => {
    const dup = structuredClone(dataset);
    dup.videos.push({ ...dup.videos[0], title: "Another title for the same footage" });
    expect(validateDataset(dup).join()).toMatch(/same footage/);
    const twice = structuredClone(dataset);
    twice.videos.push({ ...twice.videos[0], file: "other.mp4" });
    expect(validateDataset(twice).join()).toMatch(/duplicate title/);
  });
  it("refuses a test-looking creator, a vertical clip without a prompt and a prompt that allows faces", () => {
    const bad = structuredClone(dataset);
    bad.creators[0].displayName = "QA Creator";
    bad.videos.push({ ...bad.videos[0], file: "tall.mp4", title: "A tall one without a prompt", orientation: "vertical" });
    bad.generate.clips["beach-dance.mp4"] = { prompt: "A woman walking on a beach", model: "m", aspect: "16:9" };
    const out = validateDataset(bad).join("\n");
    expect(out).toMatch(/not a test account/);
    expect(out).toMatch(/needs its generation prompt/);
    expect(out).toMatch(/must say there is no face/);
  });
});

describe("what a creator has vs the dataset", () => {
  const wanted = [{ title: "Slow jazz" }, { title: "Neon alley" }];
  it("uploads what is missing and deletes what is not wanted or twice there", () => {
    const { upload, remove } = diffCreator(wanted, [
      { id: "1", title: "Slow jazz" },
      { id: "2", title: "Neon hallway" },
      { id: "3", title: "slow jazz" },
    ]);
    expect(upload.map((v) => v.title)).toEqual(["Neon alley"]);
    expect(remove.map((v) => v.id)).toEqual(["2", "3"]);
  });
  it("is a no-op once seeded", () => {
    const { upload, remove } = diffCreator(wanted, [{ id: "1", title: "Slow jazz" }, { id: "2", title: "Neon alley" }]);
    expect(upload).toEqual([]);
    expect(remove).toEqual([]);
  });
});

describe("replacing a silent clip by its sound version", () => {
  it("replaces a video the caller marks stale, once, and leaves the others", () => {
    const wanted = [{ title: "Slow jazz" }, { title: "Neon alley" }];
    const have = [{ id: "1", title: "Slow jazz", description: "x" }, { id: "2", title: "Neon alley", description: "sound: y" }];
    const { upload, remove, replace } = diffCreator(wanted, have, (w, h) => !h.description.includes("sound:"));
    expect(replace.map((h) => h.id)).toEqual(["1"]);
    expect(upload.map((v) => v.title)).toEqual(["Slow jazz"]);
    expect(remove).toEqual([]);
  });
});

describe("replacing an SD clip by its HD version", () => {
  it("is an upgrade only when the media folder's file is taller than the one the creator has (and the creator has one, measured)", () => {
    expect(isUpgrade({ height: 1080 }, { height: 480 })).toBe(true);
    expect(isUpgrade({ height: 1080 }, { height: 1080 })).toBe(false);
    expect(isUpgrade({ height: 480 }, { height: 1080 })).toBe(false);
    expect(isUpgrade({ height: 1080 }, { height: 0 })).toBe(false); // still encoding: not measured, never replaced
    expect(isUpgrade(undefined, { height: 480 })).toBe(false);
  });
  it("replaces the SD video once and leaves the HD one", () => {
    const wanted = [{ title: "Slow jazz" }, { title: "Neon alley" }];
    const have = [{ id: "1", title: "Slow jazz", height: 480 }, { id: "2", title: "Neon alley", height: 1080 }];
    const heights = { "Slow jazz": 1080, "Neon alley": 1080 };
    const { upload, replace } = diffCreator(wanted, have, (w, h) => isUpgrade({ height: heights[w.title] }, h));
    expect(replace.map((h) => h.id)).toEqual(["1"]);
    expect(upload.map((v) => v.title)).toEqual(["Slow jazz"]);
  });
});

describe("the credit", () => {
  it("says the clip was upscaled, by what model, to what size", () => {
    expect(credit({ orazakaRunId: "abc", model: "Wan 2.2 A14B (x) — DigitalOcean", upscale: { to: "1080p", model: "SeedVR2 3B" } })).toBe("Made with Orazaka · run abc (Wan 2.2 A14B (x)) · upscaled to 1080p by SeedVR2 3B.");
  });
  it("names the Orazaka run and the model", () => {
    expect(credit({ orazakaRunId: "abc", model: "Wan 2.2 A14B (x) — DigitalOcean" })).toBe("Made with Orazaka · run abc (Wan 2.2 A14B (x)).");
    expect(credit({ orazakaRunId: "abc", sound: "ACE-Step 1.5 (MIT)", soundRunId: "def" })).toBe("Made with Orazaka · run abc · sound: ACE-Step 1.5 (MIT), run def.");
    expect(credit({})).toBeNull();
  });
});
