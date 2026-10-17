import { describe, expect, it } from "vitest";

import nextConfig from "../next.config.mjs";

type Redirect = { source: string; destination: string; permanent: boolean; has?: { key: string; value: string }[] };

describe("old dashboard addresses redirect to the /me pages", () => {
  it("each /dashboard?tab=… goes to its page (308), and /earnings, /insights, /dashboard too", async () => {
    const rules = (await nextConfig.redirects!()) as Redirect[];
    const forTab = (tab: string) => rules.find((r) => r.source === "/dashboard" && r.has?.[0]?.value === tab);
    expect(forTab("uploads")?.destination).toBe("/me/videos");
    expect(forTab("ledger")?.destination).toBe("/me/transactions");
    expect(forTab("playlists")?.destination).toBe("/me/collections");
    expect(forTab("settings")?.destination).toBe("/me/settings");
    expect(rules.find((r) => r.source === "/earnings")?.destination).toBe("/me/earnings");
    expect(rules.find((r) => r.source === "/insights")?.destination).toBe("/me/insights");
    expect(rules.find((r) => r.source === "/dashboard" && !r.has)?.destination).toBe("/me");
    expect(rules.filter((r) => r.destination.startsWith("/me")).every((r) => r.permanent)).toBe(true);
  });

  it("the public profile stays /@handle, distinct from the private /me", async () => {
    const rewrites = (await nextConfig.rewrites!()) as { source: string; destination: string }[];
    expect(rewrites).toContainEqual({ source: "/@:username", destination: "/creators/:username" });
  });
});
