import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The phone is a picture of the app, not a control: it must never draw a focus ring around itself
// (a purple rectangle appeared on dev.orochia.com when it was clicked). Krizaka UI's Tabs.Content paints
// `focus-visible:ring-2`; the showcase switches it off and keeps the real controls (the tabs) focusable.
const source = readFileSync(new URL("./ProductShowcase.tsx", import.meta.url), "utf8");
const content = source.match(/<Tabs\.Content[^>]*>/)?.[0] ?? "";

describe("ProductShowcase phone", () => {
  it("has a tab panel that draws no focus ring or outline", () => {
    expect(content).not.toBe("");
    expect(content).toContain("focus-visible:ring-0");
    expect(content).toContain("focus:outline-none");
  });
  it("is not a tab stop (Radix would give the panel tabindex 0 otherwise)", () => {
    expect(content).toContain("tabIndex={-1}");
  });
});
