#!/usr/bin/env node
/* check-static-pages — the public pages that do not read the database stay static, in each language.
   Reads the production build's prerender manifest (apps/web/.next/prerender-manifest.json): a page that reads the
   request (headers, cookies) is not prerendered and drops out of it. Usage: node scripts/check-static-pages.mjs [manifest] */
import { existsSync, readFileSync } from "node:fs";

export const LOCALES = ["en", "fr"];
export const STATIC_PAGES = ["/legal/terms", "/legal/privacy", "/legal/2257", "/legal/dmca", "/how-it-works", "/mobile", "/docs"];

/** The pages of STATIC_PAGES, in each language, that the manifest does not list as prerendered. */
export function missingStaticPages(manifest) {
  const prerendered = new Set(Object.keys(manifest.routes ?? {}));
  return LOCALES.flatMap((locale) => STATIC_PAGES.map((page) => `/${locale}${page}`)).filter((route) => !prerendered.has(route));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2] ?? "apps/web/.next/prerender-manifest.json";
  if (!existsSync(file)) {
    console.error(`check-static-pages: ${file} not found — run the production build first`);
    process.exit(1);
  }
  const missing = missingStaticPages(JSON.parse(readFileSync(file, "utf8")));
  if (missing.length) {
    console.error(`check-static-pages: not static (they read the request): ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log(`check-static-pages: ok — ${LOCALES.length * STATIC_PAGES.length} pages prerendered`);
}
