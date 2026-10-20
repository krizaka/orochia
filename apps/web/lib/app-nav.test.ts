import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { accountLinks, isCurrent, RAIL_ITEMS } from "./app-nav";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

describe("the rail (a bottom tab bar on a phone)", () => {
  it("keeps four destinations; with Create at the foot it stays within a phone bar's five", () => {
    expect(RAIL_ITEMS.map((i) => i.id)).toEqual(["home", "explore", "auctions", "challenges"]);
    expect(RAIL_ITEMS.length + 1).toBeLessThanOrEqual(5);
  });
  it("marks one section current; Home only on /", () => {
    expect(isCurrent("/", "/")).toBe(true);
    expect(isCurrent("/explore", "/")).toBe(false);
    expect(isCurrent("/explore/tags/x", "/explore")).toBe(true);
    expect(isCurrent("/auctions", "/explore")).toBe(false);
  });
});

describe("the account menu", () => {
  it("lists the space, messages, wallet, the app and settings; creators add their earnings", () => {
    expect(accountLinks(false).map((l) => l.id)).toEqual(["dashboard", "messages", "wallet", "mobile", "settings"]);
    expect(accountLinks(true).map((l) => l.id)).toEqual(["dashboard", "earnings", "messages", "wallet", "mobile", "settings"]);
  });
});

describe("the signed-in bars are @krizaka/ui's, none is hand-made", () => {
  const shell = read("../components/ClientLayoutShell.tsx");
  it("composes RailNav, AppHeader and AccountMenu", () => {
    expect(shell).toContain("@krizaka/ui/rail-nav");
    expect(read("../components/AppBar.tsx")).toContain("@krizaka/ui/app-header");
    expect(read("../components/AppBar.tsx")).toContain("@krizaka/ui/account-menu");
  });
  it("no local Navbar or bottom tab bar remains", () => {
    expect(() => read("../components/Navbar.tsx")).toThrow();
    expect(() => read("../components/MobileBottomNav.tsx")).toThrow();
  });
  it("keeps search, the bell, messages and the earnings", () => {
    const bar = read("../components/AppBar.tsx");
    for (const piece of ["NotificationBell", "MessagesButton", "onOpenSearch", "balanceCents"]) expect(bar).toContain(piece);
  });
});

describe("the app bar on a phone", () => {
  it("shows the mark alone, not a truncated word, below 640 px", () => {
    expect(read("../components/AppBar.tsx")).toContain('className="kz-appbar"');
    expect(read("../app/[locale]/globals.css")).toMatch(/max-width:\s*639\.98px\)\s*\{\s*\.kz-appbar a > span:not\(\[data-brand-mark\]\)\s*\{\s*display:\s*none/);
  });
});
