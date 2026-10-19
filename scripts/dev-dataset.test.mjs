import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { credit, diffCreator, provenance, isUpgrade, retag, storiesToPost, storySource, validateDataset } from "./dev-dataset/plan.mjs";

const dataset = JSON.parse(readFileSync(new URL("./dev-dataset/dataset.json", import.meta.url), "utf8"));

describe("the dev dataset", () => {
  it("is curated: distinct footage and titles, prompts without faces", () => {
    expect(validateDataset(dataset)).toEqual([]);
  });
  it("shows no QA handle: a creator's @handle reads as a person", () => {
    const bad = structuredClone(dataset);
    bad.creators[0].username = "qa_creator";
    expect(validateDataset(bad).join()).toMatch(/must read as a person, not a QA account/);
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

describe("the provenance (orochia#268): the same run as data, for the AI badge", () => {
  it("names the generator, the run and the model (the part before the host), nothing else", () => {
    expect(provenance({ orazakaRunId: "abc123", model: "Wan 2.2 A14B (x) — DigitalOcean" })).toEqual({ generator: "orazaka", runId: "abc123", model: "Wan 2.2 A14B (x)" });
    expect(provenance({ orazakaRunId: "abc123" })).toEqual({ generator: "orazaka", runId: "abc123" });
  });
  it("is absent for a clip no run made", () => {
    expect(provenance({})).toBeNull();
    expect(provenance(undefined)).toBeNull();
  });
  it("keeps the model within what the API accepts (120 characters)", () => {
    expect(provenance({ orazakaRunId: "abcdef", model: "m".repeat(300) }).model.length).toBe(120);
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

describe("what the dataset changes on a video that is already there", () => {
  it("re-states the tags of the kept videos (a renamed tag reaches the dev site without a re-upload)", () => {
    const wanted = [{ title: "Slow jazz", tags: ["music", "jazz", "club"] }, { title: "Neon alley", tags: ["night"] }];
    const have = [{ id: "1", title: "slow jazz" }, { id: "2", title: "Other" }];
    expect(retag(wanted, have)).toEqual([{ id: "1", tags: ["music", "jazz", "club"] }]);
  });
  it("skips a video that is being replaced or deleted", () => {
    expect(retag([{ title: "A", tags: ["x"] }], [{ id: "1", title: "A" }], new Set(["1"]))).toEqual([]);
  });
});

describe("the demo stories renew themselves (they last 24 h)", () => {
  const stories = [
    { creator: "lena", file: "a.mp4", caption: "A", url: "https://cdn/a.mp4" },
    { creator: "lena", file: "b.mp4", caption: "B", url: "https://cdn/b.mp4" },
    { creator: "noah", file: "c.mp4", caption: "C", url: "https://cdn/c.mp4" },
  ];
  it("posts a creator's stories only when none of hers is up", () => {
    expect(storiesToPost(stories, "lena", 0).map((s) => s.file)).toEqual(["a.mp4", "b.mp4"]);
    expect(storiesToPost(stories, "lena", 1)).toEqual([]);
    expect(storiesToPost(stories, "noah", 0).map((s) => s.file)).toEqual(["c.mp4"]);
    expect(storiesToPost(stories, "kofi", 0)).toEqual([]);
  });
  it("reads the clip from the media folder when it is there, else from the CDN (the scheduled job has no folder)", () => {
    expect(storySource(stories[0], () => true, "/media")).toEqual({ local: "/media/a.mp4" });
    expect(storySource(stories[0], () => false, "/media")).toEqual({ url: "https://cdn/a.mp4" });
    expect(storySource({ creator: "x", file: "z.mp4" }, () => false, "/media")).toBeNull();
  });
  it("every story of the dataset has a creator of the dataset and a CDN clip", () => {
    const keys = new Set(dataset.creators.map((c) => c.key));
    for (const s of dataset.stories) {
      expect(keys.has(s.creator)).toBe(true);
      expect(s.url).toMatch(/^https:\/\/krizaka-assets\.b-cdn\.net\/site\/products\/orochia\/demo-stories\/[a-z-]+\.[0-9a-f]{10}\.mp4$/);
    }
  });
});
