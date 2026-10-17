"use client";

import { createI18nReact } from "@krizaka/i18n/react";
import { useMemo, type ReactNode } from "react";

import type { Messages } from "./i18n";
import { i18nTools, type I18nTools } from "./i18n";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./locales";

// The browser receives one catalogue (the active language, resolved on the server), never all of them.
const react = createI18nReact<Messages, Locale>({ locales: LOCALES, defaultLocale: DEFAULT_LOCALE });

/** Mounted once in the root layout with the language the server resolved and its catalogue. */
export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  return <react.I18nProvider locale={locale} messages={messages}>{children}</react.I18nProvider>;
}

/** What a client component needs to speak: `const { t, locale, money } = useI18n()`. */
export function useI18n(): I18nTools {
  const { locale, messages, t } = react.useI18n();
  return useMemo(() => i18nTools(locale, t, messages), [locale, messages, t]);
}
