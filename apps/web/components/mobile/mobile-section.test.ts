import React from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { serverHtmlIn } from "@/lib/i18n-test-utils";

import { MobileSection } from "./MobileSection";

vi.mock("@/lib/i18n-server", () => import("@/lib/i18n-test-server"));

describe("the home page's mobile section", () => {
  let html = "";
  beforeAll(async () => {
    html = await serverHtmlIn("en", MobileSection, {});
  });
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
