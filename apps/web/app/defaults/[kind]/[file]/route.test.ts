import { describe, expect, it } from "vitest";

import { isDefaultFile } from "./route";

describe("the defaults route reaches only the default pictures", () => {
  it("accepts the preset files", () => {
    expect(isDefaultFile("avatars", "clay-1-512.webp")).toBe(true);
    expect(isDefaultFile("avatars", "clay-1-256.webp")).toBe(true);
    expect(isDefaultFile("banners", "mural-1.webp")).toBe(true);
  });
  it("refuses anything else of the zone", () => {
    expect(isDefaultFile("avatars", "../documents/x.webp")).toBe(false);
    expect(isDefaultFile("banners", "clay-1-512.webp")).toBe(false);
    expect(isDefaultFile("documents", "mural-1.webp")).toBe(false);
    expect(isDefaultFile("avatars", "unknown-512.webp")).toBe(false);
  });
});
