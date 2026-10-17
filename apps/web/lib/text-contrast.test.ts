import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * WCAG 1.4.3 (contrast, AA) at the source: a coloured word is written with a text role of @krizaka/tailwind
 * (`text-fg-accent`, `text-fg-success`, `text-fg-danger`, `text-fg-warning`, `text-fg-info` — ≥ 4.5:1 on every surface,
 * both themes), never with the fill colour of the same role (`text-accent` is the velvet of a button: 3.4:1 on the
 * dark page; `text-success` is 2.6:1 on white). axe checks the pages it opens (e2e/a11y.mjs); this checks every file.
 */
const ROOT = path.resolve(__dirname, "..");
const FILL_AS_TEXT = /(?<![\w-])text-(accent|success|danger|warning|info)(?![\w-])/g;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return /\.(tsx?|css)$/.test(entry.name) && full !== __filename ? [full] : [];
  });
}

describe("text contrast", () => {
  it("colours text with the fg-* roles, never with a fill colour", () => {
    const offenders = ["app", "components", "lib"]
      .flatMap((dir) => sources(path.join(ROOT, dir)))
      .flatMap((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          .flatMap((line, i) => [...line.matchAll(FILL_AS_TEXT)].map((m) => `${path.relative(ROOT, file)}:${i + 1} ${m[0]}`)),
      );
    expect(offenders).toEqual([]);
  });
});
