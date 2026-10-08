import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { consumeToken, markEmailVerified } from "@/lib/account-tokens";
import { getSession, setSessionCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Verifies an e-mail address with the link's one-time token (48 h); refreshes the session of that account. */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const limit = await checkRateLimit(`verify-email:${ip}`, 20, 60 * 60);
    if (!limit.success) return jsonError(429, "Too many attempts. Try again later.");
    const { token } = z.object({ token: z.string().min(1).max(200) }).parse(await req.json());
    const userId = await consumeToken(token, "VERIFY_EMAIL");
    if (!userId) return jsonError(400, "This link is invalid or has expired. Ask for a new one.");
    await markEmailVerified(userId);
    const response = NextResponse.json({ success: true });
    const session = await getSession();
    if (session?.id === userId) setSessionCookie(response, { ...session, emailVerified: true });
    return response;
  } catch (error) {
    return errorResponse(error, "auth/verify-email");
  }
}
