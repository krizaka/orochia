import { db, users } from "@orochia/db";
import { eq } from "drizzle-orm";

import { getLocale } from "./i18n-server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./locales";

/** The language an account chose (`users.locale`), if it chose one. */
export async function accountLocale(userId: string): Promise<Locale | null> {
  const [row] = await db.select({ locale: users.locale }).from(users).where(eq(users.id, userId)).limit(1);
  return isLocale(row?.locale) ? row.locale : null;
}

/** Remembers the language of an account: e-mails, push and live notifications are written in it. */
export async function setAccountLocale(userId: string, locale: Locale): Promise<void> {
  await db.update(users).set({ locale }).where(eq(users.id, userId));
}

/**
 * The language to write to someone in: their account's if they chose one, else the one of the request that is being
 * served (a sign-up, a reset asked from a page), else English — never a failure, a mail goes out in some language.
 */
export async function languageFor(userId?: string | null): Promise<Locale> {
  if (userId) {
    const chosen = await accountLocale(userId).catch(() => null);
    if (chosen) return chosen;
  }
  return getLocale().catch(() => DEFAULT_LOCALE);
}
