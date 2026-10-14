// The public documentation of Orochia, from the repository's own docs/ — `lib/public-docs.json` is the allow-list
// (a doc not listed stays internal). Writes the git-ignored `lib/docs-bundle.generated.json` (slug, title, description,
// markdown) that /docs renders, so the running image needs no file from docs/. Run by predev and prebuild.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = resolve(here, "../../../docs");
const LIST = resolve(here, "../lib/public-docs.json");
const OUT = resolve(here, "../lib/docs-bundle.generated.json");

/** Splits the YAML-ish front matter (`title`, `description`) from the markdown body. */
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
  return { title: meta.title || heading || "Untitled", description: meta.description || "", markdown: body.trim() };
}

export function buildBundle(list = JSON.parse(readFileSync(LIST, "utf8")), dir = DOCS_DIR) {
  return list.map(({ slug, file }) => ({ slug, file, ...parseDoc(readFileSync(resolve(dir, file), "utf8")) }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const bundle = buildBundle();
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(bundle));
  console.log(`docs bundle: ${bundle.length} pages`);
}
