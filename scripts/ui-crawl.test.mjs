// Dev preview `ui.themes-devices` (orochia#241): the UI crawl exists, covers both themes and both viewports, and CI runs it.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

describe("the UI crawl", () => {
  const crawl = read("e2e/ui-crawl.mjs");
  it("covers dark and light, phone and desktop", () => {
    expect(crawl).toMatch(/THEMES = \["dark", "light"\]/);
    expect(crawl).toMatch(/desktop:/);
    expect(crawl).toMatch(/phone:/);
  });
  it("checks what the criterion asks: console errors, horizontal scroll, one footer, broken pictures", () => {
    for (const needle of ["pageerror", "horizontal scroll", "page footers", "broken picture", "empty tile"]) expect(crawl).toContain(needle);
  });
  it("is an npm script and a CI step of the e2e job, after the accessibility run", () => {
    expect(JSON.parse(read("package.json")).scripts["test:ui-crawl"]).toBe("node e2e/ui-crawl.mjs");
    const ci = read(".github/workflows/ci.yml");
    expect(ci).toContain("npm run test:ui-crawl");
    expect(ci.indexOf("npm run test:a11y")).toBeLessThan(ci.indexOf("npm run test:ui-crawl"));
  });
  it("saves captures only to a scratch folder (OUT), never into the repository", () => {
    expect(crawl).toMatch(/process\.env\.OUT/);
    expect(crawl).not.toMatch(/docs\/screenshots/);
  });
});
