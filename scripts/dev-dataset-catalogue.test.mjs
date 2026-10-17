import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildJobs, derivePassword, emailOf, loadCatalogue, seedOf, slug, validateCatalogue } from "./dev-dataset/catalogue.mjs";

const dir = new URL("./dev-dataset/", import.meta.url).pathname;
const cat = loadCatalogue(dir);
const first = JSON.parse(readFileSync(new URL("./dev-dataset/dataset.json", import.meta.url), "utf8"));
const known = Object.fromEntries(first.creators.map((c) => [c.key, first.videos.filter((v) => v.creator === c.key).map((v) => v.title)]));

describe("the dev dataset catalogue (v2)", () => {
  it("is curated: fictional adults, distinct titles, non-explicit prompts, collections that name real videos", () => {
    expect(validateCatalogue(cat, known)).toEqual([]);
  });
  it("is the size the load test needs", () => {
    expect(cat.creators.length).toBeGreaterThanOrEqual(30);
    expect(cat.creators.flatMap((c) => c.videos).length).toBeGreaterThanOrEqual(100);
    expect(cat.fans.length).toBeGreaterThanOrEqual(20);
    expect(cat.challenges.map((c) => c.kind).sort().filter((k, i, a) => a.indexOf(k) === i)).toEqual(["GOAL", "OPEN_CALL", "REQUEST"]);
  });
  it("catches a duplicate title, an explicit prompt and a missing vertical clip", () => {
    const bad = structuredClone(cat);
    const rich = bad.creators.filter((c) => c.videos.length);
    rich[0].videos[1].title = rich[0].videos[0].title;
    rich[1].videos[0].still = "A nude figure on a beach";
    for (const v of rich[2].videos) v.orientation = "horizontal";
    const out = validateCatalogue(bad, known).join("\n");
    expect(out).toMatch(/duplicate title/);
    expect(out).toMatch(/non-explicit/);
    expect(out).toMatch(/at least one vertical/);
  });
  it("does not mistake an innocent word for an explicit one", () => {
    const ok = structuredClone(cat);
    ok.creators.find((c) => c.videos.length).videos[0].motion = "The cat nudges the mug off the desk.";
    expect(validateCatalogue(ok, known)).toEqual([]);
  });
  it("builds every still before the clips made from them, with stable seeds", () => {
    const jobs = buildJobs(cat);
    const firstClip = jobs.findIndex((j) => j.kind === "clip");
    expect(jobs.slice(0, firstClip).every((j) => j.kind === "image")).toBe(true);
    for (const j of jobs.filter((x) => x.kind === "clip")) expect(jobs.some((s) => s.kind === "image" && s.id === j.from)).toBe(true);
    expect(buildJobs(cat).map((j) => j.seed)).toEqual(jobs.map((j) => j.seed));
    expect(seedOf("a")).not.toBe(seedOf("a", 1));
    expect(new Set(jobs.filter((j) => j.kind === "image").map((j) => j.id)).size).toBe(jobs.filter((j) => j.kind === "image").length);
  });
  it("derives a password from the secret and the username, never the same twice", () => {
    expect(derivePassword("s", "a_user")).toBe(derivePassword("s", "a_user"));
    expect(derivePassword("s", "a_user")).not.toBe(derivePassword("s", "b_user"));
    expect(derivePassword("s", "a_user")).not.toBe(derivePassword("t", "a_user"));
    expect(derivePassword("s", "a_user").length).toBeGreaterThanOrEqual(24);
    expect(emailOf("a_user")).toBe("qa+a_user@orochia.com");
  });
  it("has the influencer lifestyle cluster: 8 creators, about 30 videos, MATURE ones gated, A14B 720p heroes without a start picture", () => {
    const life = cat.creators.filter((c) => cat.groups.lifestyle.includes(c.key));
    expect(life.length).toBeGreaterThanOrEqual(6);
    expect(life.flatMap((c) => c.videos).length).toBeGreaterThanOrEqual(28);
    expect(life.filter((c) => c.rating === "MATURE").length).toBeGreaterThanOrEqual(4);
    expect(life.every((c) => c.stories.length >= 5)).toBe(true);
    const heroes = buildJobs(cat).filter((j) => j.hero);
    expect(heroes.length).toBeGreaterThanOrEqual(10);
    expect(heroes.every((j) => j.model === "wan2.2-t2v-a14b" && j.kind === "clip")).toBe(true);
    expect(JSON.stringify(cat.creators)).not.toMatch(/GTA|grand theft/i);
  });
  it("slugs a title for a file name", () => {
    expect(slug("Marché Jean-Talon in late October")).toBe("marche-jean-talon-in-late-october");
  });
});
