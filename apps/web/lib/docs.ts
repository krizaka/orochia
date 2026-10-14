/**
 * The public documentation of Orochia: the repository's own docs/*.md, the allow-list in `public-docs.json`, bundled
 * at build by scripts/gen-docs-bundle.mjs and rendered here. Links between docs become /docs/<slug>; a link to any
 * other file of the repository points at GitHub.
 */
import { Marked } from "marked";

import bundle from "./docs-bundle.generated.json";
import { SOURCE_URL } from "./seo";

export interface Doc {
  slug: string;
  file: string;
  title: string;
  description: string;
  markdown: string;
}

export const DOCS: readonly Doc[] = bundle as Doc[];

export function findDoc(slug: string): Doc | undefined {
  return DOCS.find((doc) => doc.slug === slug);
}

/** Where a markdown link of a doc leads: another public doc, an anchor, an external URL, or the file on GitHub. */
export function resolveDocHref(href: string, docs: readonly Pick<Doc, "slug" | "file">[] = DOCS): string {
  if (/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(href)) return href;
  const [path, hash] = href.split("#");
  const file = path.replace(/^\.\//, "");
  const doc = docs.find((d) => d.file === file);
  if (doc) return `/docs/${doc.slug}${hash ? `#${hash}` : ""}`;
  const repoPath = file.startsWith("../") ? file.slice(3) : `docs/${file}`;
  return `${SOURCE_URL}/blob/main/${repoPath}${hash ? `#${hash}` : ""}`;
}

export function renderDoc(markdown: string, docs: readonly Pick<Doc, "slug" | "file">[] = DOCS): string {
  const marked = new Marked({
    gfm: true,
    walkTokens(token) {
      if (token.type === "link") token.href = resolveDocHref(token.href, docs);
    },
  });
  return marked.parse(markdown, { async: false });
}
