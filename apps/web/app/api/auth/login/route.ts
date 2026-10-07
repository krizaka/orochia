import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, users, verifyPassword } from "@orochia/db";
import { eq, or } from "drizzle-orm";
import { setSessionCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const LoginSchema = z.object({
  identifier: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(256),
});

/** Password login. The role comes from the account, never from the request. */
export async function POST(req: NextRequest) {
  try {
    const { identifier, password } = LoginSchema.parse(await req.json());
    const key = identifier.toLowerCase();

    const limit = await checkRateLimit(`login:${key}`, 10, 15 * 60);
    if (!limit.success) return jsonError(429, "Too many attempts. Try again later.");

    const [account] = await db
      .select()
      .from(users)
      .where(or(eq(users.email, key), eq(users.username, key)))
      .limit(1);

    if (!account || !verifyPassword(password, account.passwordHash)) {
      return jsonError(401, "Invalid credentials");
    }
    if (account.suspendedAt) return jsonError(403, "This account is suspended. Contact the platform operator.");

    const response = NextResponse.json({ success: true });
    setSessionCookie(response, {
      id: account.id,
      username: account.username,
      email: account.email,
      role: account.role,
      isAgeVerified: account.isAgeVerified,
    });
    return response;
  } catch (error) {
    return errorResponse(error, "auth/login");
  }
}
