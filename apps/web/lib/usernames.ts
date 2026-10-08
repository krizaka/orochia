import { db, users } from "@orochia/db";
import { inArray } from "drizzle-orm";

/**
 * Usernames are the public address of an account (orochia.com/@username) and are unique (users.username is UNIQUE);
 * display names are free and may repeat. Two "Oussama Abid" get @oussama_abid and @oussama_abid2.
 */

export const USERNAME = /^[a-z0-9_]{3,30}$/;

/** Words that would impersonate the platform or collide with app paths. */
const RESERVED = new Set(["admin", "administrator", "orochia", "support", "help", "official", "staff", "moderator", "root", "system", "api", "auth", "dashboard", "settings", "messages", "explore", "creator", "creators", "watch", "legal", "me", "null", "undefined"]);

export function isReserved(username: string): boolean {
  return RESERVED.has(username) || username.startsWith("orochia");
}

/** A username-shaped base from any name: accents removed, lowercase, letters, digits and underscores. */
export function usernameBase(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 26);
  return base.length >= 3 ? base : `member_${base}`.slice(0, 26);
}

/** The base itself when free, else the first free base2…base99, else base + a random suffix. */
export async function freeUsername(name: string): Promise<string> {
  const base = usernameBase(name);
  const candidates = [base, ...Array.from({ length: 98 }, (_, i) => `${base}${i + 2}`)].filter((c) => !isReserved(c));
  const taken = new Set((await db.select({ u: users.username }).from(users).where(inArray(users.username, candidates))).map((r) => r.u));
  return candidates.find((c) => !taken.has(c)) ?? `${base}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Whether a username can be taken, and a free one to suggest when it cannot. */
export async function checkUsername(input: string): Promise<{ available: boolean; reason?: "format" | "reserved" | "taken"; suggestion?: string }> {
  const username = input.trim().toLowerCase().replace(/^@/, "");
  if (!USERNAME.test(username)) return { available: false, reason: "format", suggestion: await freeUsername(username || "member") };
  if (isReserved(username)) return { available: false, reason: "reserved", suggestion: await freeUsername(`${username}_x`) };
  const suggestion = await freeUsername(username);
  return suggestion === username ? { available: true } : { available: false, reason: "taken", suggestion };
}
