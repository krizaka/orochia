import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, users } from "@orochia/db";
import { and, eq, isNull } from "drizzle-orm";
import { sendPasswordResetEmail } from "@/lib/account-tokens";
import { isDemoMode } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * E-mails a password-reset link (1 h) to the address, if an active account uses it. The answer is the
 * same either way, so the endpoint never tells which addresses are registered.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { email } = z.object({ email: z.string().trim().toLowerCase().email().max(255) }).parse(await req.json());
    const limit = await checkRateLimit(`forgot:${ip}`, 10, 60 * 60);
    const perAddress = await checkRateLimit(`forgot:${email}`, 3, 60 * 60);
    if (!limit.success || !perAddress.success) return jsonError(429, "Too many requests. Try again later.");
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
