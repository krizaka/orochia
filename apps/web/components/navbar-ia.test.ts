import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";

// Dev preview `ux.ia-review` (orochia#242): the navigation maps the person's jobs to at most about five top-level
// items, with no mixed concepts and no orphan entry (docs/UX_DECISIONS.md, « UX/IA review of the web app »).
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const bar = read("./Navbar.tsx");
const tabs = read("./MobileBottomNav.tsx");
const footer = read("./SiteFooter.tsx");

describe("the web navigation (UX/IA review)", () => {
  it("has three sections in the bar — Explore, Auctions, Challenges — and no more than five", () => {
    const links = [...bar.matchAll(/navLink\("(\/[a-z-]+)"/g)].map((m) => m[1]);
    expect(links).toEqual(["/explore", "/auctions", "/challenges"]);
    expect(links.length).toBeLessThanOrEqual(5);
  });

  it("keeps the phone's tab bar to five places (Home, Explore, Create, Saved or Messages, Account)", () => {
    const targets = new Set([...tabs.matchAll(/href=\{?["`]?([^"`}\s]+)/g)].map((m) => m[1]!.split("?")[0]));
    expect(targets.size).toBeLessThanOrEqual(6);
  });

  it("holds the person's own things in the account menu and one platform link — the app, decided with the simplified home — never docs", () => {
    const menu = bar.slice(bar.indexOf('role="menu"'));
    const links = [...menu.matchAll(/menuItem\("(\/[a-z/-]+)"/g)].map((m) => m[1]);
    expect(links).toEqual(["/me", "/messages", "/wallet", "/mobile", "/me/settings"]);
    expect(menu).not.toContain("/docs");
    expect(footer).toContain('"/mobile"');
  });

  it("names every bar entry in the catalogue (no hard-coded label)", () => {
    for (const key of ["explore", "auctions", "challenges", "mobile"] as const) expect(en.nav[key]).toBeTruthy();
  });
});
