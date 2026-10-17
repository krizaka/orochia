import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildBundle, parseDoc } from "../scripts/gen-docs-bundle.mjs";
import { docHref, docsOf, EMOJI, findDoc, renderDoc, renderDocPage, resolveDocHref } from "./docs";
import { docsRedirects } from "./docs-redirects.mjs";
import allowList from "./public-docs.json";

const DOCS = [
  { slug: "auctions", file: "AUCTIONS.md", audience: "developers" as const, locale: "en" as const },
  { slug: "start", file: "guide/start.md", audience: "guide" as const, locale: "en" as const },
];

describe("docs bundle", () => {
  it("reads the title, nav and description from the front matter, else the first heading, and drops that heading", () => {
    expect(parseDoc("---\ntitle: Getting Started\nnav: Start\ndescription: Five commands.\n---\n\n# Getting Started\n\nbody")).toMatchObject({ title: "Getting Started", nav: "Start", description: "Five commands.", markdown: "body" });
    expect(parseDoc("# Only a heading\n\ntext")).toMatchObject({ title: "Only a heading", nav: "Only a heading", markdown: "text" });
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

describe("docs routes", () => {
  const all = buildBundle() as { slug: string; audience: "guide" | "developers"; locale: "en" | "fr"; title: string; nav: string; markdown: string }[];
  const bundle = all.filter((d) => d.locale === "en");

  it("every doc has an address that is unique and resolves to itself", () => {
    const hrefs = bundle.map(docHref);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const doc of bundle) {
      expect(doc.audience === "guide" || doc.audience === "developers").toBe(true);
      expect(docHref(doc)).toBe(doc.audience === "developers" ? `/docs/developers/${doc.slug}` : `/docs/${doc.slug}`);
    }
    expect(findDoc("guide", "start")?.title).toBeTruthy();
    expect(findDoc("guide", "architecture")).toBeUndefined();
    expect(docsOf("developers").length).toBeGreaterThan(5);
  });

  it("the guide starts with a user page, and the run-locally page is a developers' page", () => {
    expect(allowList[0]).toMatchObject({ slug: "start", audience: "guide" });
    expect(allowList.find((d) => d.slug === "getting-started")?.audience).toBe("developers");
    expect(allowList.find((d) => d.slug === "mobile" && d.audience === "developers")).toBeTruthy();
    expect(allowList.find((d) => d.slug === "mobile" && d.audience === "guide")).toBeTruthy();
  });

  it("a navigation title fits on one line", () => {
    for (const doc of bundle) expect(doc.nav.length, `${doc.slug}: ${doc.nav}`).toBeLessThanOrEqual(28);
  });

  it("every link to another documentation page lands on a page that exists", () => {
    const known = new Set(bundle.map(docHref));
    for (const doc of bundle) {
      for (const m of doc.markdown.matchAll(/\]\((\/docs\/[a-z0-9/-]+)(#[^)]*)?\)/g)) expect(known.has(m[1]), `${doc.slug} links to ${m[1]}`).toBe(true);
    }
  });
});

describe("docs in two languages", () => {
  const doc = (slug: string, audience: "guide" | "developers", locale: "en" | "fr") => ({ slug, file: `${slug}.md`, audience, locale, title: `${slug}-${locale}`, nav: slug, description: "", markdown: "x" });
  const docs = [doc("start", "guide", "en"), doc("faq", "guide", "en"), doc("start", "guide", "fr"), doc("auctions", "developers", "en")];

  it("a French reader gets the French page when there is one, the English one when there is not", () => {
    expect(docsOf("guide", "fr", docs).map((d) => d.title)).toEqual(["start-fr", "faq-en"]);
    expect(findDoc("guide", "start", "fr", docs)?.locale).toBe("fr");
    expect(findDoc("guide", "faq", "fr", docs)?.locale).toBe("en");
  });

  it("the table of contents is the English one, in its order, whatever the language", () => {
    expect(docsOf("guide", "fr", docs).map((d) => d.slug)).toEqual(docsOf("guide", "en", docs).map((d) => d.slug));
  });

  it("the developers' pages are English for everyone", () => {
    expect(docsOf("developers", "fr", docs).map((d) => d.locale)).toEqual(["en"]);
  });
});

describe("old addresses", () => {
  const bundle = buildBundle() as { slug: string; audience: string }[];

  it("a page that moved to /docs/developers answers 308 at its old address", () => {
    const rules = docsRedirects();
    for (const slug of ["getting-started", "architecture", "media-pipeline", "realtime", "development", "deployment", "ux-decisions"]) {
      expect(rules).toContainEqual({ source: `/docs/${slug}`, destination: `/docs/developers/${slug}`, permanent: true });
    }
    expect(rules).toContainEqual({ source: "/docs/developers", destination: "/docs", permanent: true });
  });

  it("the same pages answer 308 with the language in the address (/en and /fr lived there too)", () => {
    const rules = docsRedirects();
    expect(rules).toContainEqual({ source: "/:locale(en|fr)/docs/architecture", destination: "/:locale/docs/developers/architecture", permanent: true });
    expect(rules).toContainEqual({ source: "/:locale(en|fr)/docs/developers", destination: "/:locale/docs", permanent: true });
  });

  it("every redirect leads to a page that exists, and never shadows a page of the guide", () => {
    const developers = new Set(bundle.filter((d) => d.audience === "developers").map((d) => d.slug));
    const guide = new Set(bundle.filter((d) => d.audience === "guide").map((d) => d.slug));
    for (const r of docsRedirects()) {
      expect(r.permanent).toBe(true);
      const slug = r.source.replace("/:locale(en|fr)", "").replace("/docs/", "");
      if (r.destination.startsWith("/docs/developers/")) {
        expect(developers.has(slug), `${r.source} -> ${r.destination}`).toBe(true);
        expect(guide.has(slug), `${r.source} shadows a guide page`).toBe(false);
      }
    }
  });
});

describe("docs content rules", () => {
  const bundle = buildBundle() as { slug: string; audience: string; markdown: string }[];
  const headings = (md: string) => {
    let fence = false;
    return md.split("\n").filter((line) => {
      if (line.startsWith("```")) fence = !fence;
      return !fence && /^#{1,6}\s/.test(line);
    });
  };

  it("no heading carries an emoji", () => {
    for (const doc of bundle) for (const h of headings(doc.markdown)) expect(EMOJI.test(h), `${doc.audience}/${doc.slug}: ${h}`).toBe(false);
  });

  it("the guide shows no API path and no internals", () => {
    for (const doc of bundle.filter((d) => d.audience === "guide")) {
      expect(doc.markdown, doc.slug).not.toMatch(/\/api\//);
      expect(doc.markdown, doc.slug).not.toMatch(/\b(Expo|React Native|Maestro|EAS|FCM|APNs|Drizzle|PostgreSQL)\b/);
      expect(EMOJI.test(doc.markdown), `${doc.slug} has an emoji`).toBe(false);
    }
  });

  it("an image of the guide has a caption", () => {
    for (const doc of bundle.filter((d) => d.audience === "guide")) {
      for (const m of doc.markdown.matchAll(/!\[([^\]]*)\]\(/g)) expect(m[1].length, doc.slug).toBeGreaterThan(5);
    }
  });
});

describe("docs rendering", () => {
  it("turns a link to another public doc into its route, keeping its anchor", () => {
    expect(resolveDocHref("AUCTIONS.md", DOCS)).toBe("/docs/developers/auctions");
    expect(resolveDocHref("./AUCTIONS.md#bids", DOCS)).toBe("/docs/developers/auctions#bids");
    expect(resolveDocHref("start.md", DOCS)).toBe("/docs/start");
    expect(docHref({ slug: "faq", audience: "guide" })).toBe("/docs/faq");
  });

  it("sends a link to any other file to GitHub, and leaves external links, routes and anchors alone", () => {
    expect(resolveDocHref("../AGENTS.md", DOCS)).toBe("https://github.com/krizaka/orochia/blob/main/AGENTS.md");
    expect(resolveDocHref("ADMIN_CONSOLE.md", DOCS)).toBe("https://github.com/krizaka/orochia/blob/main/docs/ADMIN_CONSOLE.md");
    expect(resolveDocHref("https://krizaka.com", DOCS)).toBe("https://krizaka.com");
    expect(resolveDocHref("/docs/faq", DOCS)).toBe("/docs/faq");
    expect(resolveDocHref("#section", DOCS)).toBe("#section");
  });

  it("renders markdown with its links resolved", () => {
    const html = renderDoc("# T\n\nSee [auctions](AUCTIONS.md).\n\n| a | b |\n| - | - |\n| 1 | 2 |", DOCS);
    expect(html).toContain('<a href="/docs/developers/auctions">auctions</a>');
    expect(html).toContain("<table>");
  });

  it("gives every heading an anchor, lists the h2s for the contents, and frames a phone screenshot", () => {
    const { html, toc } = renderDocPage('## Get the app\n\ntext\n\n## Get the app\n\n### Sign in\n\n![The gate on a fresh install](https://x.test/a.webp "phone")', DOCS);
    expect(toc).toEqual([{ id: "get-the-app", label: "Get the app" }, { id: "get-the-app-1", label: "Get the app" }]);
    expect(html).toContain('<h3 id="sign-in">Sign in</h3>');
    expect(html).toContain('<span class="doc-phone"><img src="https://x.test/a.webp" alt="The gate on a fresh install"');
  });
});
