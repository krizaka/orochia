// The redirects of the documentation, read by next.config.mjs and tested (lib/docs.test.ts): a page that moved to the
// developers' section keeps its old address, which answers 308 (permanent: true) with the new one.
import { readFileSync } from "node:fs";

const legacy = JSON.parse(readFileSync(new URL("./docs-legacy.json", import.meta.url), "utf8"));

export function docsRedirects() {
  return [
    // With and without the language in the address (the pages lived at /en/docs/<slug> and /fr/docs/<slug> too).
    ...legacy.slugs.flatMap((slug) => [
      { source: `/docs/${slug}`, destination: `/docs/developers/${slug}`, permanent: true },
      { source: `/:locale(en|fr)/docs/${slug}`, destination: `/:locale/docs/developers/${slug}`, permanent: true },
    ]),
    { source: "/docs/developers", destination: "/docs", permanent: true },
    { source: "/:locale(en|fr)/docs/developers", destination: "/:locale/docs", permanent: true },
  ];
}
