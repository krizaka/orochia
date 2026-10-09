import { createI18n, type MessageKey as KeyOf } from "@krizaka/i18n";

import en from "@/messages/en.json";

/**
 * Every user-facing string lives in messages/<locale>.json — English (en.json) is the reference and
 * the only locale for now. Keys are typed from en.json, so a missing or misspelt key fails to compile;
 * a second language adds messages/<locale>.json with the same shape and its locale here.
 * Variables: t("stories.views", { count: 3 }) fills {count}.
 * The engine (lookup, fallback, format, plurals, <Rich>) is @krizaka/i18n, shared with every Krizaka
 * app: this file only binds it to Orochia's catalogue.
 */

export type Messages = typeof en;

export type MessageKey = KeyOf<Messages>;

const i18n = createI18n<Messages, "en">({ en }, { defaultLocale: "en" });

/** A whole branch of messages, for long structured content rendered from data (legal pages). */
export function messages<K extends keyof Messages>(key: K): Messages[K] {
  return i18n.getDictionary("en")[key];
}

export const t = i18n.t;

export { format } from "@krizaka/i18n";

/** The reader's locale, for numbers, money and dates (@krizaka/intl). English is the only locale for now. */
export function currentLocale(): string {
  return "en-US";
}
