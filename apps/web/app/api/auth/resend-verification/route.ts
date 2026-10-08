import { NextResponse } from "next/server";
import { db, users } from "@orochia/db";
import { eq } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/account-tokens";
import { isDemoMode } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** E-mails a new verification link to the signed-in account (the previous link stops working). */
export async function POST() {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"], { allowUnverifiedEmail: true });
    if (user.emailVerified) return NextResponse.json({ success: true, alreadyVerified: true });
    const limit = await checkRateLimit(`resend-verification:${user.id}`, 3, 60 * 60);
    if (!limit.success) return jsonError(429, "A link was sent a moment ago. Check your inbox, or try again in an hour.");
    const [account] = await db.select({ id: users.id, email: users.email, username: users.username }).from(users).where(eq(users.id, user.id)).limit(1);
    const link = await sendVerificationEmail(account);
    return NextResponse.json({ success: true, devVerificationUrl: isDemoMode() ? link : undefined });
  } catch (error) {
    return errorResponse(error, "auth/resend-verification");
  }
}
