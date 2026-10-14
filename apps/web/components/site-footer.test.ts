import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "./SiteFooter";
import { BUILD_INFO } from "@/lib/build-info";

describe("the footer", () => {
  const html = renderToStaticMarkup(SiteFooter());
  it("says which version runs, discreetly", () => {
    expect(html).toContain('data-testid="app-version"');
    expect(html).toContain(`Version ${BUILD_INFO.version}`);
  });
  it("links the company: A Krizaka product", () => {
    expect(html).toContain('href="https://www.krizaka.com"');
    expect(html).toContain("A Krizaka product");
  });
});
