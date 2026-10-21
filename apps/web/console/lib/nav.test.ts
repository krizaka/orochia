import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { NAV_SECTIONS, navItems } from "./nav";

// Dev preview `admin.ux-review` (orochia-admin#49): the operator's jobs map to at most about five sections, no mixed
// concepts, no orphan entry (docs/UX_DECISIONS.md).
const appDir = join(__dirname, "..", "..", "app", "console");
const pages = readdirSync(appDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !["api", "login"].includes(d.name) && existsSync(join(appDir, d.name, "page.tsx")))
  .map((d) => `/${d.name}`);

describe("the console's navigation (UX/IA review)", () => {
  it("has at most five sections, each with a name and at least one entry", () => {
    expect(NAV_SECTIONS.length).toBeLessThanOrEqual(5);
    for (const section of NAV_SECTIONS) {
      expect(section.label.length).toBeGreaterThan(2);
      expect(section.items.length).toBeGreaterThan(0);
    }
  });

  it("lists every screen of the console once, and nothing that does not exist", () => {
    const hrefs = navItems().map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect([...hrefs.filter((h) => h !== "/")].sort()).toEqual([...pages].sort());
    expect(hrefs).toContain("/");
  });

  it("keeps money, people, content and the platform apart (no mixed concepts)", () => {
    const sectionOf = (href: string) => NAV_SECTIONS.find((s) => s.items.some((i) => i.href === href))?.id;
    expect(sectionOf("/treasury")).toBe("money");
    expect(sectionOf("/auctions")).toBe("money");
    expect(sectionOf("/users")).toBe("people");
    expect(sectionOf("/compliance")).toBe("people");
    expect(sectionOf("/moderation")).toBe("content");
    expect(sectionOf("/catalogue")).toBe("content");
    expect(sectionOf("/operations")).toBe("platform");
    expect(sectionOf("/audit")).toBe("platform");
  });
});
