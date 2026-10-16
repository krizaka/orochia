import { describe, expect, it } from "vitest";

import { DEFAULT_AVATARS, DEFAULT_BANNERS, defaultAvatarFor, defaultBannerFor } from "./presets";

describe("default avatars and banners", () => {
  it("offers 16 avatars and 9 banners, each in the product's own /defaults path", () => {
    expect(DEFAULT_AVATARS).toHaveLength(16);
    expect(DEFAULT_BANNERS).toHaveLength(9);
    expect(new Set(DEFAULT_AVATARS.map((p) => p.id)).size).toBe(16);
    for (const p of DEFAULT_AVATARS) expect(p.url).toBe(`/defaults/avatars/${p.id}-512.webp`);
    for (const p of DEFAULT_BANNERS) expect(p.url).toBe(`/defaults/banners/${p.id}.webp`);
  });
  it("gives a person the same default every time, and different people different ones", () => {
    expect(defaultAvatarFor("user-1")).toBe(defaultAvatarFor("user-1"));
    expect(defaultBannerFor("user-1")).toBe(defaultBannerFor("user-1"));
    const spread = new Set(Array.from({ length: 200 }, (_, i) => defaultAvatarFor(`user-${i}`)));
    expect(spread.size).toBeGreaterThan(12);
  });
  it("serves the small size for avatars on request, the 512 by default for the preset", () => {
    expect(defaultAvatarFor("x", 256)).toMatch(/-256\.webp$/);
    expect(defaultAvatarFor("x", 512)).toMatch(/-512\.webp$/);
  });
});
