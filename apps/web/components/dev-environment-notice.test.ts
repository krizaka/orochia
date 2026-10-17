import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { serverHtmlIn } from "@/lib/i18n-test-utils";

import { DevEnvironmentNotice } from "./DevEnvironmentNotice";

vi.mock("@/lib/i18n-server", () => import("@/lib/i18n-test-server"));

describe("the development-environment line", () => {
  it("is a calm sentence on the design tokens (readable in dark and light), not a banner", async () => {
    const html = await serverHtmlIn("en", DevEnvironmentNotice, {});
    expect(html).toContain("Development environment — access by invitation");
    expect(html).toContain("text-fg-muted");
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(|fixed|sticky/i);
  });

  it("says it in French when the request is French", async () => {
    expect(await serverHtmlIn("fr", DevEnvironmentNotice, {})).toContain("Environnement de développement — accès sur invitation");
  });

  it("is rendered by the layout only when the deployment is not open to search engines (the one flag)", () => {
    const layout = readFileSync(join(__dirname, "..", "app", "layout.tsx"), "utf8");
    expect(layout).toContain("{!INDEXABLE && <DevEnvironmentNotice />}");
  });
});
