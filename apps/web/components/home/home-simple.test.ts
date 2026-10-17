import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("the visitor's home reads in five seconds", () => {
  it("the phone has four tabs: watch, stories, support, auction", () => {
    expect(read("./showcase/Scenes.tsx")).toContain('export const SCENES = ["feed", "stories", "support", "auction"] as const;');
  });
  it("the home is the feed: three tabs, a shelf and a grid, one intro line for a visitor and no pitch", () => {
    const page = read("../../app/(home)/page.tsx");
    expect(page).toContain("FeedFilterTabs");
    expect(page).toContain("home-intro");
    expect(page).not.toMatch(/HomeHero|GetPaid|MobileSection|CreatorsCallToAction|kz-marquee|home\.marquee/);
    expect(read("../VideoGrid.tsx")).toContain("@krizaka/ui/media-grid");
  });
  it("the pitch lives on /how-it-works, built from the kit's blocks", () => {
    const page = read("../../app/how-it-works/page.tsx");
    expect(page).toContain("GetPaid");
    expect(page).toContain("MobileSection");
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
