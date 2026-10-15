import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("the visitor's home reads in five seconds", () => {
  it("the phone has four tabs: watch, stories, support, auction", () => {
    expect(read("./showcase/Scenes.tsx")).toContain('export const SCENES = ["feed", "stories", "support", "auction"] as const;');
  });
  it("the hero is the kit's PageHero with one primary and one quiet action, no counter, no chip row", () => {
    const hero = read("./HomeHero.tsx");
    expect(hero).toContain("@krizaka/ui/page-hero");
    expect(hero).toContain('shape="cut"');
    expect(hero).not.toMatch(/home\.stats|home\.ways|home\.trust|home\.eyebrow|RotatingWord/);
  });
  it("the page carries no marquee and builds its features from the kit's blocks", () => {
    const page = read("../../app/page.tsx");
    expect(page).not.toMatch(/kz-marquee|home\.marquee/);
    expect(page).toContain("@krizaka/ui/argument-card");
  });
  it("makes no 4K promise (the ladder tops out at 1080p)", () => {
    expect(read("../../messages/en.json")).not.toMatch(/4K/);
  });
  it("the top bar lists fans' destinations only; the app is in the footer and the account menu", () => {
    const nav = read("../Navbar.tsx");
    expect(nav).not.toContain('navLink("/mobile"');
    expect(nav).toContain('menuItem("/mobile"');
    expect(read("../SiteFooter.tsx")).toContain('link("/mobile"');
  });
});
