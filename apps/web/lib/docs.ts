/**
 * The public documentation of Orochia, in two audiences: the **Guide** (fans and creators, docs/guide/*.md, at
 * /docs/<slug>) and the **Developers'** pages (the open-source project, docs/*.md, at /docs/developers/<slug>). The
 * allow-list `public-docs.json` is the table of contents, bundled at build by scripts/gen-docs-bundle.mjs. Links between
 * docs become their route; a link to any other file of the repository points at GitHub.
 */
import { Marked, type Tokens } from "marked";

import bundle from "./docs-bundle.generated.json";
import { SOURCE_URL } from "./seo";

export type DocAudience = "guide" | "developers";
/** The language a doc is written in. The Guide is in English and in French; the developers' pages in English only. */
export type DocLocale = "en" | "fr";

export interface Doc {
  slug: string;
  file: string;
  audience: DocAudience;
  /** The language of the page; a doc without a French twin is shown in English to a French reader. */
  locale: DocLocale;
  title: string;
  /** The short, one-line name in the navigation. */
  nav: string;
  description: string;
  markdown: string;
}

export const AUDIENCES: readonly DocAudience[] = ["guide", "developers"];

export const DOCS: readonly Doc[] = bundle as Doc[];

/**
 * The pages of an audience, in the order of the table of contents, each in `locale` when it has a twin in that language
 * and in English otherwise (the English page is the reference and the table of contents).
 */
export function docsOf(audience: DocAudience, locale: DocLocale = "en", docs: readonly Doc[] = DOCS): Doc[] {
  return docs
    .filter((d) => d.audience === audience && d.locale === "en")
    .map((d) => (locale === "en" ? d : docs.find((x) => x.audience === audience && x.slug === d.slug && x.locale === locale) ?? d));
}

export function findDoc(audience: DocAudience, slug: string, locale: DocLocale = "en", docs: readonly Doc[] = DOCS): Doc | undefined {
  return docsOf(audience, locale, docs).find((doc) => doc.slug === slug);
}

/** Where a doc lives: the Guide at /docs/<slug>, the developers' pages at /docs/developers/<slug>. */
export function docHref(doc: Pick<Doc, "slug" | "audience">): string {
  return doc.audience === "developers" ? `/docs/developers/${doc.slug}` : `/docs/${doc.slug}`;
}

/** Where a markdown link of a doc leads: another public doc, an anchor, an external URL, or the file on GitHub. */
export function resolveDocHref(href: string, docs: readonly Pick<Doc, "slug" | "file" | "audience">[] = DOCS): string {
  if (/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(href)) return href;
  const [path, hash] = href.split("#");
  const file = path.replace(/^\.\//, "");
  const doc = docs.find((d) => d.file === file || d.file.replace(/^guide\//, "") === file);
  if (doc) return `${docHref(doc)}${hash ? `#${hash}` : ""}`;
  const repoPath = file.startsWith("../") ? file.slice(3) : `docs/${file}`;
  return `${SOURCE_URL}/blob/main/${repoPath}${hash ? `#${hash}` : ""}`;
}

/** An emoji or pictograph — never in a heading of the documentation. */
export const EMOJI = /\p{Extended_Pictographic}/u;

/** A heading's anchor: lower-case words joined by hyphens. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

const plain = (text: string) => text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[`*_]/g, "");
const attr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export interface RenderedDoc {
  html: string;
  /** The `h2`s, for the page's table of contents. */
  toc: { id: string; label: string }[];
}

/**
 * Markdown to HTML. Every heading gets an anchor; the `h2`s are returned for the table of contents. An image titled
 * "phone" (`![alt](url "phone")`) is drawn in a phone frame with its caption.
 */
export function renderDocPage(markdown: string, docs: readonly Pick<Doc, "slug" | "file" | "audience">[] = DOCS): RenderedDoc {
  const toc: RenderedDoc["toc"] = [];
  const seen = new Map<string, number>();
  const ids = new WeakMap<object, string>();
  const marked = new Marked({
    gfm: true,
    walkTokens(token) {
      if (token.type === "link") token.href = resolveDocHref(token.href, docs);
      if (token.type === "heading") {
        const base = slugify(plain(token.text)) || "section";
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        const id = n === 0 ? base : `${base}-${n}`;
        ids.set(token, id);
        if (token.depth === 2) toc.push({ id, label: plain(token.text) });
      }
    },
    renderer: {
      heading(this, token: Tokens.Heading) {
        const id = ids.get(token);
        return `<h${token.depth}${id ? ` id="${id}"` : ""}>${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
      },
      image({ href, title, text }: Tokens.Image) {
        const img = `<img src="${attr(href)}" alt="${attr(text)}" loading="lazy" decoding="async">`;
        return title === "phone" ? `<span class="doc-phone">${img}<span class="doc-phone-caption">${attr(text)}</span></span>` : img;
      },
    },
  });
  const html = marked.parse(markdown, { async: false });
  return { html, toc };
}

export function renderDoc(markdown: string, docs: readonly Pick<Doc, "slug" | "file" | "audience">[] = DOCS): string {
  return renderDocPage(markdown, docs).html;
}
