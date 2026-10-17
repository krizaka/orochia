import { createI18n, type MessageKey as KeyOf } from "@krizaka/i18n";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { bytes, clock, compact, date, dateShort, dateTime, duration, money, number, speed, timeAgo } from "./format";
import { DEFAULT_LOCALE, intlLocale, type Locale } from "./locales";

/**
 * Every user-facing string lives in messages/<locale>.json — English (en.json) is the reference, French a language of
 * design. Keys are typed from en.json, so a missing or misspelt key fails to compile, and fr.json is typed against it:
 * a key missing from French fails here. `krizaka-i18n check` (npm run lint) checks the rest (no empty string, the same
 * {placeholders} and markup). Variables: t("stories.views", { count: 3 }).
 * The engine (lookup, fallback, format, plurals, <Rich>) is @krizaka/i18n, shared with every Krizaka app: this file
 * only binds it to Orochia's catalogues. A server component reads the language with `getI18n()` (lib/i18n-server.ts), a
 * client component with `useI18n()` (lib/i18n-client.tsx) — there is no ambient language.
 */
export type Messages = typeof en;

export type MessageKey = KeyOf<Messages>;

export type { Locale } from "./locales";
export { DEFAULT_LOCALE, LOCALES } from "./locales";

// A key missing from (or added to) fr.json fails type-checking here.
const french: Messages = fr;

export const i18n = createI18n<Messages, Locale>({ en, fr: french }, { defaultLocale: DEFAULT_LOCALE });

export const asLocale = (value: unknown): Locale => i18n.asLocale(value);

/** The catalogue of a language (for what a client component receives, and for long structured content). */
export const getDictionary = (locale: Locale): Messages => i18n.getDictionary(locale);

export { format } from "@krizaka/i18n";

/** A translator that knows its language (`t.locale`): what a helper needs to format a size or a date as the reader writes it. */
export type Translator = ReturnType<typeof i18n.translator> & { readonly locale: Locale };

const withLocale = (t: ReturnType<typeof i18n.translator>, locale: Locale): Translator =>
  Object.assign(((...args: unknown[]) => (t as (...a: unknown[]) => string)(...args)) as typeof t, { locale })

/** Everything a screen needs to speak a language: the translator, the Intl locale, amounts, sizes, durations. */
export function i18nTools(locale: Locale, translate: ReturnType<typeof i18n.translator>, dictionary: Messages) {
  const t = withLocale(translate, locale);
  return {
    locale,
    t,
    /** A whole branch of messages, for long structured content rendered from data (legal pages). */
    messages: <K extends keyof Messages>(key: K): Messages[K] => dictionary[key],
    /** The Intl locale (`en-US`, `fr-CA`) for numbers, money and dates (@krizaka/intl). */
    currentLocale: () => intlLocale(locale),
    money: (cents: number) => money(cents, locale),
    compact: (n: number) => compact(n, locale),
    bytes: (n: number) => bytes(n, locale),
    speed: (bytesPerSecond: number) => speed(bytesPerSecond, locale),
    duration: (seconds: number | null) => duration(seconds, locale),
    number: (n: number) => number(n, locale),
    date: (value: string | number | Date) => date(value, locale),
    dateShort: (value: string | number | Date) => dateShort(value, locale),
    dateTime: (value: string | number | Date) => dateTime(value, locale),
    clock: (value: string | number | Date) => clock(value, locale),
    timeAgo: (value: string | number | Date) => timeAgo(value, locale),
  };
}

export type I18nTools = ReturnType<typeof i18nTools>;

/** The tools of a language, built from the catalogues (server side and tests; the browser builds them from its provider). */
export function toolsFor(locale: Locale): I18nTools {
  return i18nTools(locale, i18n.translator(locale), getDictionary(locale));
}
