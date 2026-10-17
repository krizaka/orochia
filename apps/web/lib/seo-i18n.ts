import type { Metadata } from "next";

import { getLocale } from "./i18n-server";
import { LOCALES, localizedPath, type Locale } from "./locales";

/**
 * The canonical address and the hreflang alternates of a page, in the language it is served in: English lives at the
 * path itself, French at `/fr<path>` (the proxy serves it); x-default is the English one. A French page is canonical to
 * itself, never to the English one.
 */
export function alternatesFor(path: string, locale: Locale): NonNullable<Metadata["alternates"]> {
  return {
    canonical: localizedPath(path, locale),
    languages: { ...Object.fromEntries(LOCALES.map((l) => [l, localizedPath(path, l)])), "x-default": localizedPath(path, "en") },
  };
}

/** `alternatesFor` in the language of the current request. */
export async function pageAlternates(path: string): Promise<NonNullable<Metadata["alternates"]>> {
  return alternatesFor(path, await getLocale());
}
