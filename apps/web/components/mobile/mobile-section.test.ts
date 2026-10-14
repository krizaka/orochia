import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MobileSection } from "./MobileSection";

describe("the home page's mobile section", () => {
  const html = renderToStaticMarkup(React.createElement(MobileSection));
  it("shows the four steps as phone recordings, played on demand — none autoplays", () => {
    expect((html.match(/<video/g) ?? []).length).toBe(4);
    expect(html).not.toContain("autoplay");
    expect(html).toContain('preload="none"');
    expect(html).toMatch(/poster="https:\/\/krizaka-assets\.b-cdn\.net\/site\/products\/orochia\/mobile\//);
  });
  it("links to every clip and screenshot", () => {
    expect(html).toContain('href="/mobile"');
  });
  it("says nothing is live", () => {
    expect(html.toLowerCase()).not.toMatch(/\blive\b/);
  });
});
