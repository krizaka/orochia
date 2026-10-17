import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { JOURNEY, WAYS } from "@/lib/how-it-works";
import { tourRecording } from "@/lib/site-media";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const en = JSON.parse(read("../../messages/en.json")) as { howItWorks: Record<string, Record<string, string>> };

describe("/how-it-works is short: hero, journey, four ways, closing", () => {
  const page = read("../../app/[locale]/how-it-works/page.tsx");

  it("has exactly four sections, each labelled, and none of the old long blocks", () => {
    expect(page.match(/<section\b|<SectionBackdrop\b/g)).toHaveLength(4);
    expect(page).not.toMatch(/GetPaid|MobileSection|CreatorsCallToAction|FEATURES|WHY|FAN_CLIPS|CREATOR_CLIPS|home\.features|home\.why/);
  });

  it("the journey is the seven steps, in the order they happen, each with a real clip", () => {
    expect(JOURNEY.map((s) => s.id)).toEqual(["find", "watch", "tip", "unlock", "bid", "back", "earn"]);
    for (const step of JOURNEY) expect(() => tourRecording(step.clip)).not.toThrow();
  });

  it("the four ways are tip, unlock, auction and goal, each one line with its moment from the app", () => {
    expect(WAYS.map((w) => w.id)).toEqual(["tip", "unlock", "auction", "goal"]);
    for (const way of WAYS) expect(() => tourRecording(way.clip)).not.toThrow();
  });

  it("every step and way is a single short line (no paragraphs), the share comes from the setting", () => {
    for (const s of JOURNEY) expect(en.howItWorks.steps![s.id]!.length).toBeLessThanOrEqual(90);
    for (const w of WAYS) expect(en.howItWorks.ways![`${w.id}Line`]!.length).toBeLessThanOrEqual(90);
    expect(JSON.stringify(en.howItWorks)).not.toMatch(/90 %/);
    expect(page).toContain("platformFeePercent");
  });

  it("the journey is one swappable slot: the page only passes JOURNEY to it", () => {
    expect(page).toContain("<Journey");
    expect(read("./Journey.tsx")).toContain("JOURNEY");
  });
});

describe("the version lives in the footer, not the bar", () => {
  it("the bar no longer carries the build chip", () => {
    const nav = read("../Navbar.tsx");
    expect(nav).not.toContain("BuildBadge");
  });
});
