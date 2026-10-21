import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BuildBadge } from "./BuildBadge";

describe("the environment badge (NAV-SYS)", () => {
  it("shows the environment, links the commit, names the whole build", () => {
    const html = renderToStaticMarkup(<BuildBadge info={{ version: "1.2.3", env: "dev", sha: "abcdef0" }} />);
    expect(html).toContain(">dev<");
    expect(html).toContain("https://github.com/krizaka/orochia/commit/abcdef0");
    expect(html).toContain("Version v1.2.3 · dev · abcdef0");
  });
  it("is absent in production", () => {
    expect(renderToStaticMarkup(<BuildBadge info={{ version: "1.2.3", env: "production", sha: null }} />)).toBe("");
  });
  it("the header carries no family switcher", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./AdminHeader.tsx", import.meta.url), "utf8") + readFileSync(new URL("./AdminSidebar.tsx", import.meta.url), "utf8");
    expect(src).not.toMatch(/NavBar\.Family|site-footer/);
  });
});
