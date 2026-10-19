// The public documentation of Orochia, from the repository's own docs/ — `lib/public-docs.json` is the allow-list and
// the table of contents (slug, file, audience: `guide` for fans and creators in docs/guide/, `developers` for the open-source
// project). A doc not listed stays internal. Writes the git-ignored `lib/docs-bundle.generated.json` (slug, audience,
// title, nav, description, markdown) that /docs renders, so the running image needs no file from docs/. Run by predev and prebuild.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = resolve(here, "../../../docs");
const LIST = resolve(here, "../lib/public-docs.json");
const OUT = resolve(here, "../lib/docs-bundle.generated.json");

/**
 * Splits the YAML-ish front matter (`title`, `nav`, `description`) from the markdown body. The page's own `# heading`
 * becomes the title when there is no front matter, and is dropped from the body: the template draws the title.
 */
export function parseDoc(raw) {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
  const meta = {};
  let body = raw;
  if (match) {
    body = raw.slice(match[0].length);
    for (const line of match[1].split("\n")) {
      const kv = /^(\w+):\s*(.*)$/.exec(line);
      if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
    }
  }
  const heading = /^#\s+(.+)$/m.exec(body)?.[1];
  const title = meta.title || heading || "Untitled";
  const markdown = body.replace(/^\s*#\s+.+\n/, "").trim();
  return {
    title,
    nav: meta.nav || title,
    // Every page has a description (search engines, social cards): the front matter's, else the first paragraph.
    description: meta.description || firstParagraph(markdown),
    markdown,
  };
}

/** The first paragraph of prose (no heading, list, table, quote, fence or image), as one plain line of at most 160 characters. */
export function firstParagraph(markdown) {
  const para = markdown
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p && !/^(#|[-*>|`!]|\d+\.|<)/.test(p));
  if (!para) return "";
  const plain = para.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[`*_]/g, "").replace(/\s+/g, " ").trim();
  if (plain.length <= 160) return plain;
  const cut = plain.slice(0, 157);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 80 ? cut.lastIndexOf(" ") : 157)}…`;
}

export function buildBundle(list = JSON.parse(readFileSync(LIST, "utf8")), dir = DOCS_DIR) {
  return list.map(({ slug, file, audience = "guide", locale = "en" }) => ({ slug, file, audience, locale, ...parseDoc(readFileSync(resolve(dir, file), "utf8")) }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const bundle = buildBundle();
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(bundle));
  console.log(`docs bundle: ${bundle.length} pages`);
}
