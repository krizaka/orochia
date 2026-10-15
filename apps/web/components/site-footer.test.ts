import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "./SiteFooter";
import { BUILD_INFO } from "@/lib/build-info";

describe("the footer (@krizaka/ui's SiteFooter, NAV-SYS)", () => {
  const html = renderToStaticMarkup(SiteFooter());
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
  it("carries no family switcher (a deployed product is independent) but the build badge", () => {
    const src = readFileSync(new URL("./Navbar.tsx", import.meta.url), "utf8");
    expect(src).not.toContain("NavBar.Family");
    expect(src).toContain("<BuildBadge />");
  });
});
