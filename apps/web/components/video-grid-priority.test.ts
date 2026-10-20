import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// ORO-PERF (Explore, mobile Lighthouse): the largest contentful poster must not be lazy — it was the third card of a shelf
// of shorts — and the first screen must not preload every poster at high priority (they fight for one connection).
const grid = readFileSync(new URL("./VideoGrid.tsx", import.meta.url), "utf8");
const card = readFileSync(new URL("./VideoCard.tsx", import.meta.url), "utf8");

describe("the posters of the first screen", () => {
  it("loads the first four at once, and fetches only the first two at high priority", () => {
    expect(grid).toMatch(/const FIRST_ROW = 4;/);
    expect(grid).toMatch(/const HIGH_PRIORITY = 2;/);
    expect(grid).toMatch(/high\.has\(video\.id\) \? "high" : first\.has\(video\.id\)/);
  });

  it("a card is eager when it has any priority, high only for « high »", () => {
    expect(card).toContain('loading={props.priority ? "eager" : "lazy"}');
    expect(card).toContain('posterPriority={props.priority === "high" ? "high" : "auto"}');
  });
});
