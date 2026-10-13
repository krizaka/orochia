import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PORTRAITS, PORTRAIT_ROOT, RETIRED_AVATAR_PREFIX, portrait } from "./people";

const root = path.resolve(__dirname, "..", "..", "..");
const cast = JSON.parse(readFileSync(path.join(root, "scripts/demo/cast.json"), "utf8")) as {
  people: { key: string; displayName: string; portrait?: string; avatar?: string }[];
};
const seed = readFileSync(path.join(__dirname, "seed.ts"), "utf8");

// One face = one persona = one product: Orochia's people only ever wear Orochia's portraits, each their own.
describe("the portraits of Orochia's invented people", () => {
  const files = Object.values(PORTRAITS).flatMap((p) => [p.avatar, p.thumb]);

  it("live under Orochia's own folder on the CDN, never another product's", () => {
    for (const [persona, p] of Object.entries(PORTRAITS)) {
      for (const url of [p.avatar, p.thumb]) {
        expect(url.startsWith(PORTRAIT_ROOT)).toBe(true);
        expect(url.slice(PORTRAIT_ROOT.length)).toMatch(new RegExp(`^${persona}-(512|256)\\.[0-9a-f]{10}\\.webp$`));
      }
    }
    expect(PORTRAIT_ROOT).toMatch(/\/site\/people\/orochia\/$/);
  });

  it("never share a file between two personas", () => {
    expect(new Set(files).size).toBe(files.length);
  });

  it("give every person of the demo cast a face of their own", () => {
    const worn = cast.people.filter((p) => p.portrait).map((p) => p.portrait as string);
    expect(new Set(worn).size).toBe(worn.length);
    for (const key of worn) expect(Object.keys(PORTRAITS)).toContain(key);
    // A preset avatar is a choice offered to every member: an invented person never wears one.
    expect(cast.people.filter((p) => p.avatar)).toEqual([]);
  });

  it("replace the stock photos of real people the development seed used to write", () => {
    expect(seed).not.toMatch(/avatar:\s*img\(/);
    expect(RETIRED_AVATAR_PREFIX).toBe("https://images.unsplash.com/");
    expect(portrait("alex")).toBe(PORTRAITS.alex.avatar);
  });
});
