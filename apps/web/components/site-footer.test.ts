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
  it("is the family's: « A Krizaka product », the other sites, none of them as a hand-made link", () => {
    expect(html).toContain("A Krizaka product");
    for (const host of ["https://www.krizaka.com", "https://dev.orazaka.com", "https://ui.krizaka.com"]) expect(html).toContain(`href="${host}`);
  });
  it("links the mobile recordings and the legal pages, and keeps the 18+ statement", () => {
    expect(html).toContain('href="/mobile"');
    for (const path of ["/legal/terms", "/legal/privacy", "/legal/2257", "/legal/dmca"]) expect(html).toContain(`href="${path}"`);
    expect(html).toContain("18 years of age or older");
  });
});

describe("the bar", () => {
  it("carries the family switcher next to the brand, current = orochia", () => {
    const src = readFileSync(new URL("./Navbar.tsx", import.meta.url), "utf8");
    expect(src).toContain('<NavBar.Family current="orochia"');
    expect(src).toContain("<BuildBadge />");
  });
});
