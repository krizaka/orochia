import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * WCAG 1.4.3 (contrast, AA) at the source — found by the console's axe pass (krizaka/orochia#130): words are coloured
 * with the text roles of @krizaka/tailwind (`text-fg`, `text-fg-secondary`, `text-fg-accent`, `text-fg-success`…, ≥ 4.5:1
 * on every surface in both themes), never with a fill colour (`text-accent` is 3.4:1 on the dark page, `text-success`
 * 2.3:1 and `text-warning` 1.9:1 on the light one) nor with `text-fg-muted` (3.5–3.9:1: placeholders and disabled only).
 */
const ROOT = path.resolve(__dirname, "..", "..");
const LOW_CONTRAST_TEXT = /(?<![\w-])text-(accent|success|danger|warning|info|fg-muted)(?![\w-])/g;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return /\.tsx?$/.test(entry.name) && full !== __filename ? [full] : [];
  });
}

describe("text contrast", () => {
  it("colours words with the fg-* text roles only", () => {
    const offenders = ["app/console", "console/components", "console/lib"]
      .flatMap((dir) => sources(path.join(ROOT, dir)))
      .flatMap((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          .flatMap((line, i) => [...line.matchAll(LOW_CONTRAST_TEXT)].map((m) => `${path.relative(ROOT, file)}:${i + 1} ${m[0]}`)),
      );
    expect(offenders).toEqual([]);
  });
});
