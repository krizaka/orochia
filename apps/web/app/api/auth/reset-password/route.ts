import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, users, hashPassword } from "@orochia/db";
import { eq, sql } from "drizzle-orm";
import { consumeToken } from "@/lib/account-tokens";
import { clearSessionCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Reset = z.object({ token: z.string().min(1).max(200), password: z.string().min(10, "At least 10 characters").max(256) });

/**
 * Sets a new password with the link's one-time token (1 h). Following the link proves the address too,
 * so it is marked verified. The browser is signed out: the next sign-in uses the new password.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const limit = await checkRateLimit(`reset:${ip}`, 10, 60 * 60);
    if (!limit.success) return jsonError(429, "Too many attempts. Try again later.");
    const { token, password } = Reset.parse(await req.json());
    const userId = await consumeToken(token, "RESET_PASSWORD");
    if (!userId) return jsonError(400, "This link is invalid or has expired. Ask for a new one.");
    await db
      .update(users)
      .set({ passwordHash: hashPassword(password), emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())`, updatedAt: new Date() })
      .where(eq(users.id, userId));
    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return errorResponse(error, "auth/reset-password");
  }
}
