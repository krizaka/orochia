import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";

import { accountLinks, RAIL_ITEMS } from "../lib/app-nav";

// Dev preview `ux.ia-review` (orochia#242): the navigation maps the person's jobs to at most about five top-level
// items, with no mixed concepts and no orphan entry (docs/UX_DECISIONS.md, « UX/IA review of the web app »).
// Since orochia#320 the destinations are data (lib/app-nav.ts) drawn by @krizaka/ui's RailNav and AccountMenu.
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const footer = read("./SiteFooter.tsx");

describe("the web navigation (UX/IA review)", () => {
  it("has three sections in the rail — Explore, Auctions, Challenges — after Home, and no more than five", () => {
    expect(RAIL_ITEMS.map((i) => i.href)).toEqual(["/", "/explore", "/auctions", "/challenges"]);
    expect(RAIL_ITEMS.length).toBeLessThanOrEqual(5);
  });

  it("keeps the phone's tab bar to five places (the rail's four and Create at its foot)", () => {
    expect(RAIL_ITEMS.length + 1).toBeLessThanOrEqual(5);
    expect(read("./AppRail.tsx")).toContain("footer=");
  });

  it("holds the person's own things in the account menu and one platform link — the app, decided with the simplified home — never docs", () => {
    const links = accountLinks(false).map((l) => l.href);
    expect(links).toEqual(["/me", "/messages", "/wallet", "/mobile", "/me/settings"]);
    expect(links.some((h) => h.includes("/docs"))).toBe(false);
    expect(footer).toContain('"/mobile"');
  });

  it("names every bar entry in the catalogue (no hard-coded label)", () => {
    for (const key of ["explore", "auctions", "challenges", "mobile"] as const) expect(en.nav[key]).toBeTruthy();
  });
});
