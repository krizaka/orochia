import { createHmac, timingSafeEqual } from "node:crypto";

import { db, profiles } from "@orochia/db";
import { eq } from "drizzle-orm";

import { appUrl, sessionSecret } from "./env";
import { CATEGORIES, type Category, eventsOf, unsubscribable } from "./notification-matrix";
import { parseNotificationsOff } from "./profile";

/**
 * "Unsubscribe from this kind of e-mail", one click, per category (krizaka/orochia#261). The link carries a signed
 * token (account + category, HMAC with the session secret): no database row, no expiry — an old e-mail's link must
 * keep working — and it only ever turns e-mail OFF for one category. The security category has no such link.
 * Served as a confirmation page (GET, a person) and as RFC 8058 one-click (POST, the mail client).
 */

const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function signUnsubscribe(userId: string, category: Category, secret = sessionSecret()): string {
  if (!unsubscribable(category)) throw new Error("The security category cannot be unsubscribed");
  const payload = Buffer.from(`${userId}.${category}`).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyUnsubscribe(token: string, secret = sessionSecret()): { userId: string; category: Category } | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = sign(payload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [userId, category, ...rest] = Buffer.from(payload, "base64url").toString().split(".");
  if (rest.length || !userId || !CATEGORIES.includes(category as Category) || !unsubscribable(category as Category)) return null;
  return { userId, category: category as Category };
}

export const unsubscribeLink = (userId: string, category: Category): string => `${appUrl()}/unsubscribe?t=${signUnsubscribe(userId, category)}`;

/** The e-mail "off" list with the category's events added. */
export function eventsToSilence(emailsOff: readonly string[], category: Category) {
  return parseNotificationsOff([...emailsOff, ...eventsOf(category)]);
}

/** Turns the category's e-mails off for the account (idempotent). Returns false for an unknown account. */
export async function unsubscribeCategory(userId: string, category: Category): Promise<boolean> {
  const [row] = await db.select({ emailsOff: profiles.emailsOff }).from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!row) return false;
  await db.update(profiles).set({ emailsOff: eventsToSilence(row.emailsOff ?? [], category) }).where(eq(profiles.userId, userId));
  return true;
}
