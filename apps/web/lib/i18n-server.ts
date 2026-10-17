import { headers } from "next/headers";

import { toolsFor, type I18nTools } from "./i18n";
import { localeOf, type Locale } from "./locales";

/**
 * The language of this request (server components, `generateMetadata`, route handlers): the one a `/fr/…` address
 * asked for (the proxy writes it in a header), else the one the reader chose (cookie NEXT_LOCALE, the family's), else
 * their browser's (Accept-Language), else English. A route handler that has its `Request` reads `localeOf(req.headers)`.
 */
export async function getLocale(): Promise<Locale> {
  return localeOf(await headers());
}

/** What a server component, a route or a `generateMetadata` needs to speak: `const { t, locale, money } = await getI18n()`. */
export async function getI18n(): Promise<I18nTools> {
  return toolsFor(await getLocale());
}
