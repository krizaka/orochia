import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { credit, diffCreator, validateDataset } from "./dev-dataset/plan.mjs";

const dataset = JSON.parse(readFileSync(new URL("./dev-dataset/dataset.json", import.meta.url), "utf8"));

describe("the dev dataset", () => {
  it("is curated: distinct footage and titles, vertical clips, prompts without faces", () => {
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
    delete bad.generate.clips["vinyl-spin.mp4"];
    bad.generate.clips["neon-alley.mp4"] = "A woman walking in an alley";
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

describe("the credit", () => {
  it("names the Orazaka run and the model", () => {
    expect(credit({ orazakaRunId: "abc", model: "Wan 2.2 A14B (x) — DigitalOcean" })).toBe("Made with Orazaka — run abc (Wan 2.2 A14B (x)).");
    expect(credit({})).toBeNull();
  });
});
