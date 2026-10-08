import crypto from "crypto";
import { db, authTokens, users } from "@orochia/db";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { appUrl } from "./env";
import { sendMail } from "./mail";

/**
 * One-time links sent by e-mail: verify the address (48 h) and reset the password (1 h). The raw
 * token only exists in the link; the database keeps its SHA-256. A token works once, for its
 * purpose, before it expires — and issuing a new one retires the previous ones.
 */

export type TokenPurpose = "VERIFY_EMAIL" | "RESET_PASSWORD";
const TTL_SECONDS: Record<TokenPurpose, number> = { VERIFY_EMAIL: 48 * 3600, RESET_PASSWORD: 3600 };

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export async function issueToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.transaction(async (tx) => {
    await tx
      .update(authTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, purpose), isNull(authTokens.usedAt)));
    await tx.insert(authTokens).values({
      userId,
      purpose,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + TTL_SECONDS[purpose] * 1000),
    });
  });
  return token;
}

/** Spends a token atomically; returns its account, or null when it is unknown, used or expired. */
export async function consumeToken(token: string, purpose: TokenPurpose): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const [row] = await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authTokens.tokenHash, hash(token)),
        eq(authTokens.purpose, purpose),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, sql`now()`),
      ),
    )
    .returning({ userId: authTokens.userId });
  return row?.userId ?? null;
}

/** The links e-mailed to the account: always on this environment's public origin (NEXT_PUBLIC_APP_URL). */
export const verificationLink = (token: string) => `${appUrl()}/auth/verify?token=${token}`;
export const resetLink = (token: string) => `${appUrl()}/auth/reset-password?token=${token}`;

export async function sendVerificationEmail(user: { id: string; email: string; username: string }): Promise<string> {
  const link = verificationLink(await issueToken(user.id, "VERIFY_EMAIL"));
  await sendMail({
    to: user.email,
    subject: "Confirm your e-mail address — Orochia",
    text: `Hi @${user.username},\n\nConfirm your address to start using Orochia:\n\n${link}\n\nThe link works once, for 48 hours. If you did not create an account, ignore this message.\n\n— Orochia`,
  });
  return link;
}

export async function sendPasswordResetEmail(user: { id: string; email: string; username: string }): Promise<string> {
  const link = resetLink(await issueToken(user.id, "RESET_PASSWORD"));
  await sendMail({
    to: user.email,
    subject: "Reset your password — Orochia",
    text: `Hi @${user.username},\n\nChoose a new password here:\n\n${link}\n\nThe link works once, for one hour. If you did not ask for it, ignore this message: your password stays the same.\n\n— Orochia`,
  });
  return link;
}

/** Marks the address verified (idempotent). */
export async function markEmailVerified(userId: string) {
  await db
    .update(users)
    .set({ emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())`, updatedAt: new Date() })
    .where(eq(users.id, userId));
}
