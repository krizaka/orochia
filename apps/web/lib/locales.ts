/**
 * The languages of Orochia, with nothing to import: the proxy, the server, the browser and the tests all read this.
 * English is the default and the reference; French is a language of design (Orochia is made in Montréal, and Québec's
 * Charter of the French language expects a commercial site that serves Québec to be available in French).
 */
export type Locale = "en" | "fr";

export const LOCALES: readonly Locale[] = ["en", "fr"];

export const DEFAULT_LOCALE: Locale = "en";

/** The cookie the family shares (krizaka.com, the dev sites): the language the reader chose, kept a year. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** The request header the proxy fills with the language of a `/fr/…` address, so a page knows it before the cookie exists. */
export const LOCALE_HEADER = "x-locale";

/** The request header carrying the address as asked (before the language prefix is taken off), for canonical and hreflang. */
export const PATH_HEADER = "x-pathname";

// @fixed: a year, the lifetime of the family's language cookie (krizaka.com, the product sites)
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const isLocale = (value: unknown): value is Locale => value === "en" || value === "fr";

/** The Intl locale a language is written in: Canadian French (Québec) and US English (amounts are US dollars). */
export const intlLocale = (locale: Locale): string => (locale === "fr" ? "fr-CA" : "en-US");

/** Open Graph's name of the language. */
export const ogLocale = (locale: Locale): string => (locale === "fr" ? "fr_CA" : "en_US");

/**
 * The language a request asks for when the reader has not chosen one: the first language of Accept-Language
 * (a French browser gets French), else English. A crawler without the header reads English.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  const first = (header ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return first === "fr" || first.startsWith("fr-") ? "fr" : "en";
}

/** The address of a path in a language: `/explore` stays itself in English, becomes `/fr/explore` in French. */
export function localizedPath(path: string, locale: Locale): string {
  const clean = stripLocalePrefix(path).path;
  if (locale === "en") return clean;
  return clean === "/" ? "/fr" : `/fr${clean}`;
}

/** `/fr/explore` → `{ locale: "fr", path: "/explore" }`; an address without a prefix has no locale. */
export function stripLocalePrefix(path: string): { locale: Locale | null; path: string } {
  const match = /^\/(en|fr)(\/.*)?$/.exec(path);
  if (!match) return { locale: null, path };
  return { locale: match[1] as Locale, path: match[2] ?? "/" };
}

/**
 * The language of a request, from its headers alone (a route handler has them without any request context): the one a
 * `/fr/…` address asked for (`x-locale`, written by the proxy), else the reader's choice (cookie `NEXT_LOCALE`), else
 * their browser's (Accept-Language), else English.
 */
export function localeOf(headers: Pick<Headers, "get">): Locale {
  const asked = headers.get(LOCALE_HEADER);
  if (isLocale(asked)) return asked;
  const cookie = headers.get("cookie") ?? "";
  const chosen = new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)`).exec(cookie)?.[1];
  if (isLocale(chosen)) return chosen;
  return localeFromAcceptLanguage(headers.get("accept-language"));
}
