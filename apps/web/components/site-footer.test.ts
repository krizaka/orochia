import { readFileSync } from "node:fs";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { htmlIn } from "@/lib/i18n-test-utils";

import { SiteFooter } from "./SiteFooter";
import { BUILD_INFO } from "@/lib/build-info";

describe("the footer (@krizaka/ui's SiteFooter, NAV-SYS)", () => {
  const html = htmlIn("en", createElement(SiteFooter));
  it("says which version runs, discreetly", () => {
    expect(html).toContain('data-testid="app-version"');
    expect(html).toContain(`v${BUILD_INFO.version}`);
  });
  it("signs « A Krizaka product » (→ www.krizaka.com) and links no other site: no family columns", () => {
    expect(html).toContain("A Krizaka product");
    expect(html).toContain('href="https://www.krizaka.com"');
    expect(html).not.toContain("Krizaka family");
    for (const host of ["orazaka", "yasakia", "yororis", "ui.krizaka.com", "java.krizaka.com"]) expect(html).not.toContain(host);
  });
  it("links the mobile recordings and the legal pages, and keeps the 18+ statement", () => {
    expect(html).toContain('href="/mobile"');
    for (const path of ["/legal/terms", "/legal/privacy", "/legal/2257", "/legal/dmca"]) expect(html).toContain(`href="${path}"`);
    expect(html).toContain("18 years of age or older");
  });
});

describe("the bar", () => {
  it("carries no family switcher (a deployed product is independent) and no build badge (the version is in the footer)", () => {
    const src = readFileSync(new URL("./AppBar.tsx", import.meta.url), "utf8");
    expect(src).not.toContain("NavBar.Family");
    expect(src).not.toContain("BuildBadge");
  });
});

describe("the development notice is inside the footer, not a band under it", () => {
  it("is the footer's own line when the deployment is closed, and the layout renders no separate notice", () => {
    const layout = readFileSync(new URL("../app/[locale]/layout.tsx", import.meta.url), "utf8");
    expect(layout).not.toContain("DevEnvironmentNotice");
    expect(layout).toContain("devNotice={!INDEXABLE}");
    expect(htmlIn("en", createElement(SiteFooter, { devNotice: true }))).toContain("Development environment: access by invitation");
    expect(htmlIn("en", createElement(SiteFooter))).not.toContain("Development environment");
  });
  it("says it without an em dash (Cahier)", () => {
    for (const l of ["en", "fr"]) expect(readFileSync(new URL(`../messages/${l}.json`, import.meta.url), "utf8")).not.toMatch(/"devNotice": "[^"]*—/);
  });
});

describe("one footer, one contentinfo", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

  it("renders a single footer landmark", () => {
    expect(htmlIn("en", createElement(SiteFooter)).match(/<footer\b/g)).toHaveLength(1);
  });

  it("the root layout renders it once, after the shell (outside <main>), and no other file renders a footer", async () => {
    const layout = read("../app/[locale]/layout.tsx");
    expect(layout.match(/<SiteFooter\b/g)).toHaveLength(1);
    expect(layout.indexOf("</ClientLayoutShell>")).toBeLessThan(layout.indexOf("<SiteFooter "));
    const { globSync } = await import("node:fs");
    const offenders = globSync("{app,components}/**/*.tsx", { cwd: new URL("..", import.meta.url).pathname })
      .filter((file) => !/(^|\/)(SiteFooter|layout)\.tsx$/.test(file))
      .filter((file) => /<footer\b|<SiteFooter\b|<FamilyFooter\b/.test(read(`../${file}`)));
    expect(offenders).toEqual([]);
  });
});

describe("the rail stays fixed to the bottom of the page", () => {
  it("the footer is inside the content column (RailNav.Body), never after the shell, so the rail spans the whole page", () => {
    const layout = readFileSync(new URL("../app/[locale]/layout.tsx", import.meta.url), "utf8");
    const shell = readFileSync(new URL("./ClientLayoutShell.tsx", import.meta.url), "utf8");
    expect(layout).toMatch(/<ClientLayoutShell\s+footer=\{<SiteFooter/);
    expect(layout).not.toMatch(/<\/ClientLayoutShell>\s*<MotionObserver \/>\s*<SiteFooter/);
    expect(shell.indexOf("{footer}")).toBeGreaterThan(shell.indexOf("<RailNav.Body"));
    expect(shell.indexOf("{footer}")).toBeLessThan(shell.indexOf("</RailNav.Body>"));
  });
});
