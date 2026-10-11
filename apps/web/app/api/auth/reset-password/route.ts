import { db, hashPassword,users } from "@orochia/db";
import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { consumeToken } from "@/lib/account-tokens";
import { clearSessionCookie } from "@/lib/auth";
import { ipKey } from "@/lib/client-ip";
import { errorResponse, jsonError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const Reset = z.object({ token: z.string().min(1).max(200), password: z.string().min(10, "At least 10 characters").max(256) });

/**
 * Sets a new password with the link's one-time token (1 h). Following the link proves the address too,
 * so it is marked verified. The browser is signed out: the next sign-in uses the new password.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = ipKey(req.headers);
    await enforceRateLimit(`reset:${ip}`, 10, 60 * 60, "Too many attempts. Try again later.");
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
