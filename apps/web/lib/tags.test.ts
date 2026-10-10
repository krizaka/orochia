import { describe, expect, it } from "vitest";

import { CURATED_TAGS, hashtagsOf, MAX_TAGS, normalizeTag, normalizeTags, suggestTags,TAG_SYNONYMS } from "./tags";

describe("normalizeTag", () => {
  it("lower case, no accent, no leading #, words joined by -", () => {
    expect(normalizeTag("  #Café Crème ")).toBe("cafe-creme");
    expect(normalizeTag("Behind_The.Scenes")).toBe("behind-the-scenes");
    expect(normalizeTag("##4K")).toBe("4k");
    expect(normalizeTag("Déjà   vu!!")).toBe("deja-vu");
  });
  it("drops what is left unusable", () => {
    expect(normalizeTag("#")).toBeNull();
    expect(normalizeTag("a")).toBeNull();
    expect(normalizeTag("🔥🔥")).toBeNull();
    expect(normalizeTag("---")).toBeNull();
  });
  it("folds simple synonyms onto one tag", () => {
    expect(normalizeTag("BTS")).toBe("behind-the-scenes");
    expect(normalizeTag("making of")).toBe("behind-the-scenes");
    expect(normalizeTag("UHD")).toBe("4k");
    expect(normalizeTag("Unplugged")).toBe("acoustic");
    expect(normalizeTag("tuto")).toBe("tutorial");
  });
  it("caps the length without a trailing dash", () => {
    const tag = normalizeTag("a-very-long-tag-name-that-goes-on-and-on-forever");
    expect(tag!.length).toBeLessThanOrEqual(32);
    expect(tag!.endsWith("-")).toBe(false);
  });
  it("every synonym and curated tag is already a normalised slug", () => {
    for (const [from, to] of Object.entries(TAG_SYNONYMS)) {
      expect(from).toMatch(/^[a-z0-9-]+$/);
      expect(normalizeTag(to)).toBe(to);
    }
    for (const tag of CURATED_TAGS) expect(normalizeTag(tag)).toBe(tag);
  });
});

describe("normalizeTags", () => {
  it("deduplicates after normalising, keeps the first order", () => {
    expect(normalizeTags(["Acoustic", "acoustic", "#ACOUSTIC", "unplugged", "Concert"])).toEqual(["acoustic", "concert"]);
  });
  it("accepts a comma-separated string (the studio's edit field)", () => {
    expect(normalizeTags("Tokyo, neon , , #Neon, BTS")).toEqual(["tokyo", "neon", "behind-the-scenes"]);
  });
  it(`keeps at most ${MAX_TAGS}`, () => {
    expect(normalizeTags(Array.from({ length: 30 }, (_, i) => `tag${i}`))).toHaveLength(MAX_TAGS);
  });
  it("empty input → no tag", () => {
    expect(normalizeTags(undefined)).toEqual([]);
    expect(normalizeTags("")).toEqual([]);
  });
});

describe("suggestTags", () => {
  it("curated tags named in the title come first, then the creator's habits, most used first", () => {
    const out = suggestTags({
      previous: [{ tag: "tokyo", count: 2 }, { tag: "neon", count: 5 }],
      title: "Acoustic session",
    });
    expect(out.slice(0, 3)).toEqual(["acoustic", "neon", "tokyo"]);
  });
  it("never suggests a chosen tag, nor one twice (synonyms included)", () => {
    const out = suggestTags({ previous: [{ tag: "BTS", count: 3 }, { tag: "behind-the-scenes", count: 1 }], chosen: ["Behind the scenes"] });
    expect(out).not.toContain("behind-the-scenes");
    expect(new Set(out).size).toBe(out.length);
  });
  it("offers the hashtags typed in the description", () => {
    expect(suggestTags({ previous: [], description: "Night ride #Kyoto #nightlife" })).toEqual(expect.arrayContaining(["kyoto", "nightlife"]));
  });
  it("a new creator still gets the curated list", () => {
    expect(suggestTags({ previous: [], limit: 5 })).toEqual(CURATED_TAGS.slice(0, 5));
  });
});

describe("hashtagsOf", () => {
  it("reads a caption's hashtags as tags", () => {
    expect(hashtagsOf("New strings #Acoustic #unplugged — #Tokyo2026")).toEqual(["acoustic", "tokyo2026"]);
    expect(hashtagsOf(null)).toEqual([]);
  });
});
