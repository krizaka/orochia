import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildBundle, parseDoc } from "../scripts/gen-docs-bundle.mjs";
import { renderDoc, resolveDocHref } from "./docs";
import allowList from "./public-docs.json";

const DOCS = [{ slug: "auctions", file: "AUCTIONS.md" }];

describe("docs bundle", () => {
  it("reads the title and description from the front matter, else the first heading", () => {
    expect(parseDoc("---\ntitle: Getting Started\ndescription: Five commands.\n---\n\n# Getting Started\n\nbody")).toMatchObject({ title: "Getting Started", description: "Five commands." });
    expect(parseDoc("# Only a heading\n\ntext").title).toBe("Only a heading");
  });

  it("bundles every allow-listed doc from the repository's docs/ — a missing file fails the build", () => {
    const bundle = buildBundle();
    expect(bundle.map((d: { slug: string }) => d.slug)).toEqual(allowList.map((d) => d.slug));
    for (const doc of bundle) expect(doc.markdown.length).toBeGreaterThan(100);
  });

  it("fails on a file that does not exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "docs-"));
    writeFileSync(join(dir, "A.md"), "# A\n");
    expect(() => buildBundle([{ slug: "b", file: "B.md" }], dir)).toThrow();
  });
});

describe("docs rendering", () => {
  it("turns a link to another public doc into /docs/<slug>, keeping its anchor", () => {
    expect(resolveDocHref("AUCTIONS.md", DOCS)).toBe("/docs/auctions");
    expect(resolveDocHref("./AUCTIONS.md#bids", DOCS)).toBe("/docs/auctions#bids");
  });

  it("sends a link to any other file to GitHub, and leaves external links and anchors alone", () => {
    expect(resolveDocHref("../AGENTS.md", DOCS)).toBe("https://github.com/krizaka/orochia/blob/main/AGENTS.md");
    expect(resolveDocHref("ADMIN_CONSOLE.md", DOCS)).toBe("https://github.com/krizaka/orochia/blob/main/docs/ADMIN_CONSOLE.md");
    expect(resolveDocHref("https://krizaka.com", DOCS)).toBe("https://krizaka.com");
    expect(resolveDocHref("#section", DOCS)).toBe("#section");
  });

  it("renders markdown with its links resolved", () => {
    const html = renderDoc("# T\n\nSee [auctions](AUCTIONS.md).\n\n| a | b |\n| - | - |\n| 1 | 2 |", DOCS);
    expect(html).toContain('<a href="/docs/auctions">auctions</a>');
    expect(html).toContain("<table>");
  });
});
