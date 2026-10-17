import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import manifest from "./presets.manifest.json";
import { AVATAR_FAMILIES, BANNER_FAMILIES, DEFAULT_AVATARS, DEFAULT_BANNERS, familiesOf } from "./presets";

const items = [...manifest.avatars.map((a) => ({ kind: "avatar", ...a })), ...manifest.banners.map((b) => ({ kind: "banner", ...b }))];

describe("the presets manifest (data, not a list in a component)", () => {
  it("has no duplicate id inside a kind", () => {
    for (const list of [manifest.avatars, manifest.banners]) expect(new Set(list.map((i) => i.id)).size).toBe(list.length);
  });
  it("gives every item a family that exists, and an alt text in English and French", () => {
    for (const a of manifest.avatars) expect(Object.keys(AVATAR_FAMILIES)).toContain(a.family);
    for (const b of manifest.banners) expect(Object.keys(BANNER_FAMILIES)).toContain(b.family);
    for (const i of items) {
      expect(i.alt.en.trim().length, i.id).toBeGreaterThan(2);
      expect(i.alt.fr.trim().length, i.id).toBeGreaterThan(2);
      expect(i.alt.fr, `${i.id}: the French alt must not be the English one`).not.toBe(i.alt.en);
    }
  });
  it("serves only ids the default-file route knows: every manifest item is a preset and the other way round", () => {
    expect(DEFAULT_AVATARS.map((p) => p.id)).toEqual(manifest.avatars.map((a) => a.id));
    expect(DEFAULT_BANNERS.map((p) => p.id)).toEqual(manifest.banners.map((b) => b.id));
  });
  it("does not repeat a picture: ids are slugs and no two items share an alt text", () => {
    for (const i of items) expect(i.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    for (const list of [manifest.avatars, manifest.banners]) expect(new Set(list.map((i) => i.alt.en.toLowerCase())).size).toBe(list.length);
  });
  it("lists only families that hold at least one item, in the declared order", () => {
    for (const [kind, list, fams] of [["avatar", DEFAULT_AVATARS, AVATAR_FAMILIES], ["banner", DEFAULT_BANNERS, BANNER_FAMILIES]] as const) {
      const used = familiesOf(kind, list);
      expect(used.length).toBeGreaterThan(1);
      expect(used).toEqual(Object.keys(fams).filter((f) => list.some((p) => p.family === f)));
    }
  });
  it("offers wide banners at two widths when it says so", () => {
    for (const b of manifest.banners as { id: string; widths?: number[] }[]) if (b.widths) expect(b.widths).toEqual([800, 1600]);
  });
  it("has a generation spec for every item still to be made (scripts/dev-dataset)", () => {
    const spec = JSON.parse(readFileSync(path.resolve(__dirname, "../../../scripts/dev-dataset/profile-media-v2.json"), "utf8")) as { avatars: { id: string; family: string; prompt: string }[]; banners: { id: string; family: string; prompt: string }[] };
    expect(spec.avatars.length).toBeGreaterThanOrEqual(70);
    expect(spec.banners.length).toBeGreaterThanOrEqual(46);
    for (const s of [...spec.avatars, ...spec.banners]) expect(s.prompt).not.toMatch(/\b(nude|naked|sexy|lingerie|teen|child|celebrity)\b/i);
    expect(existsSync(path.resolve(__dirname, "../../../scripts/dev-dataset/generate-profile-media.mjs"))).toBe(true);
  });
});
