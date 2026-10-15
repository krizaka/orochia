import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DevEnvironmentNotice } from "./DevEnvironmentNotice";

describe("the development-environment line", () => {
  it("is a calm sentence on the design tokens (readable in dark and light), not a banner", () => {
    const html = renderToStaticMarkup(createElement(DevEnvironmentNotice));
    expect(html).toContain("Development environment — access by invitation");
    expect(html).toContain("text-fg-muted");
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(|fixed|sticky/i);
  });

  it("is rendered by the layout only when the deployment is not open to search engines (the one flag)", () => {
    const layout = readFileSync(join(__dirname, "..", "app", "layout.tsx"), "utf8");
    expect(layout).toContain("{!INDEXABLE && <DevEnvironmentNotice />}");
  });
});
