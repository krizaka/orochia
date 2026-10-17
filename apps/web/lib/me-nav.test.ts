import { describe, expect, it } from "vitest";

import routes from "./me-routes.json";
import { ME_GROUPS, activeMeItem, legacyMeHref, meGroupsFor } from "./me-nav";

describe("the private dashboard: sections and real addresses", () => {
  it("groups the eleven former tabs into four sections, each view on its own /me address", () => {
    expect(ME_GROUPS.map((g) => g.id)).toEqual(["content", "audience", "money", "account"]);
    const items = ME_GROUPS.flatMap((g) => g.items);
    expect(new Set(items.map((i) => i.href)).size).toBe(items.length);
    for (const i of items) expect(i.href === "/me" || i.href.startsWith("/me/")).toBe(true);
    expect(items.map((i) => i.id).sort()).toEqual(["collections", "earnings", "insights", "invitations", "library", "lists", "network", "overview", "settings", "transactions", "treasury", "videos"]);
  });

  it("a member sees no creator view, a creator no treasury, only an admin the treasury", () => {
    const ids = (role: "MEMBER" | "CREATOR" | "ADMIN") => meGroupsFor(role).flatMap((g) => g.items.map((i) => i.id));
    expect(ids("MEMBER")).not.toContain("videos");
    expect(ids("MEMBER")).not.toContain("earnings");
    expect(ids("CREATOR")).toContain("earnings");
    expect(ids("CREATOR")).not.toContain("treasury");
    expect(ids("ADMIN")).toContain("treasury");
    expect(meGroupsFor("MEMBER").every((g) => g.items.length > 0)).toBe(true);
  });

  it("the open item follows the address, deeper paths included", () => {
    expect(activeMeItem("/me")?.id).toBe("overview");
    expect(activeMeItem("/me/videos")?.id).toBe("videos");
    expect(activeMeItem("/me/earnings/")?.id).toBe("earnings");
    expect(activeMeItem("/elsewhere")).toBeUndefined();
  });

  it("every old tab address redirects to its new page, and every tab has a page", () => {
    expect(legacyMeHref("ledger")).toBe("/me/transactions");
    expect(legacyMeHref("uploads")).toBe("/me/videos");
    expect(legacyMeHref("playlists")).toBe("/me/collections");
    expect(legacyMeHref("nope")).toBe("/me");
    const hrefs = ME_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    for (const target of [...Object.values(routes.tabs), ...Object.values(routes.pages)]) expect(hrefs).toContain(target);
  });
});
