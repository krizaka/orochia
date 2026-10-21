import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { NAV_SECTIONS } from "../lib/nav";

// Dev preview `admin.shell`: the console is the Krizaka UI shell — `AppShell` for the signed-in screens (a sidebar that is a
// drawer on a phone), `AuthLayout` for the sign-in — with the DEV badge in the header, in both themes (the live crawl,
// e2e/console-crawl.mjs, proves the themes and the phone).
const root = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("the console shell", () => {
  const shell = read("console/components/ConsoleShell.tsx");
  const layout = read("app/console/layout.tsx");

  it("is @krizaka/ui's AppShell, with the skip link, the drawer words and the collapse words", () => {
    expect(shell).toContain('from "@krizaka/ui/app-shell"');
    expect(shell).toContain("AppShell.Root");
    expect(shell).toMatch(/skipLabel=/);
    expect(shell).toMatch(/menuLabel=/);
    expect(shell).toMatch(/closeLabel=/);
    expect(shell).toMatch(/collapseLabels=/);
  });

  it("draws the navigation of lib/nav.ts, every item once, the current one marked", () => {
    expect(shell).toContain("NAV_SECTIONS");
    expect(shell).toMatch(/current=\{/);
    expect(NAV_SECTIONS.flatMap((s) => s.items).length).toBeGreaterThan(10);
  });

  it("wears the DEV badge in the header, where a phone shows it too", () => {
    expect(shell).toContain("BuildBadge");
    expect(shell).toContain("AppShell.Header");
  });

  it("the layout uses the shell and no hand-made sidebar or header remains", () => {
    expect(layout).toContain("ConsoleShell");
    expect(layout).not.toMatch(/AdminSidebar|AdminHeader|<aside/);
    expect(() => read("console/components/AdminSidebar.tsx")).toThrow();
    expect(() => read("console/components/AdminHeader.tsx")).toThrow();
  });

  it("carries no family switcher or family footer (a private console)", () => {
    expect(shell).not.toMatch(/NavBar\.Family|site-footer/);
  });
});

describe("the sign-in", () => {
  it("is @krizaka/ui's AuthLayout", () => {
    const login = read("app/console/login/page.tsx");
    expect(login).toContain('from "@krizaka/ui/auth-layout"');
    expect(login).toContain("<AuthLayout");
    expect(login).not.toContain("min-h-screen");
  });
});
