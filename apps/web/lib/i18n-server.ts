import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";

import { toolsFor, type I18nTools } from "./i18n";
import { isLocale, localeOf, type Locale } from "./locales";

/**
 * The language of the current render, set by the page that knows it from its address (`/[locale]/…`): a page, a layout
 * and its `generateMetadata` call `setRequestLocale(locale)` first. That is what lets a page stay static — reading the
 * request's headers instead would make every page dynamic.
 */
const request = cache((): { locale: Locale | null } => ({ locale: null }));

export function setRequestLocale(locale: Locale): void {
  request().locale = locale;
}

/**
 * The language of this render: the one the page set from its address; a page that did not (dynamic ones, route
 * handlers) falls back to the request, which the proxy resolved (address, cookie, browser) and wrote in `x-locale`.
 */
export async function getLocale(): Promise<Locale> {
  const set = request().locale;
  if (set) return set;
  // Reading the request makes the page dynamic: only a page that did not set its language gets here.
  return localeOf(await headers());
}

/** The first line of a page or layout: takes the language from the address, sets it for the render, answers 404 for any other. */
export async function localeFromParams(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  return locale;
}

/** What a server component, a route or a `generateMetadata` needs to speak: `const { t, locale, money } = await getI18n()`. */
export async function getI18n(): Promise<I18nTools> {
  return toolsFor(await getLocale());
}
