"use client";

import { createI18nReact } from "@krizaka/i18n/react";
import { useMemo, type ReactNode } from "react";

import { i18n, i18nTools, type I18nTools } from "./i18n";
import type { Locale } from "./locales";

// The catalogues travel in the JavaScript (cached for good), not in every page: the HTML of a page stays small and static.
const react = createI18nReact(i18n);

/** Mounted once in the root layout with the language of the address. */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <react.I18nProvider locale={locale}>{children}</react.I18nProvider>;
}

/** What a client component needs to speak: `const { t, locale, money } = useI18n()`. */
export function useI18n(): I18nTools {
  const { locale, messages, t } = react.useI18n();
  return useMemo(() => i18nTools(locale, t, messages), [locale, messages, t]);
}
