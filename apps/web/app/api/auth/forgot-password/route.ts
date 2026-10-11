import { db, users } from "@orochia/db";
import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { refuseAutomation } from "@/lib/abuse/automation";
import { requireChallenge } from "@/lib/abuse/turnstile";
import { sendPasswordResetEmail } from "@/lib/account-tokens";
import { clientIp } from "@/lib/client-ip";
import { isDemoMode } from "@/lib/env";
import { errorResponse } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * E-mails a password-reset link (1 h) to the address, if an active account uses it. The answer is the
 * same either way, so the endpoint never tells which addresses are registered. Rate-limited per IP and address, and
 * behind the bot challenge when one is configured.
 */
export async function POST(req: NextRequest) {
  try {
    refuseAutomation(req.headers);
    const ip = clientIp(req.headers);
    const { email, challengeToken } = z
      .object({ email: z.string().trim().toLowerCase().email().max(255), challengeToken: z.string().max(2048).optional() })
      .parse(await req.json());
    await enforceRateLimit(`forgot:${ip ?? "unknown"}`, 10, 60 * 60, "Too many requests. Try again later.");
    await enforceRateLimit(`forgot:${email}`, 3, 60 * 60, "Too many requests. Try again later.");
    // Sends an e-mail: a bot challenge when configured, failing closed (lib/abuse/turnstile.ts).
    await requireChallenge(challengeToken, { ip, failMode: "closed" });
    const [account] = await db
      .select({ id: users.id, email: users.email, username: users.username })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.suspendedAt)))
      .limit(1);
    const link = account ? await sendPasswordResetEmail(account) : undefined;
    return NextResponse.json({ success: true, devResetUrl: isDemoMode() ? link : undefined });
  } catch (error) {
    return errorResponse(error, "auth/forgot-password");
  }
}
