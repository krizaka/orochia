import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setSessionCookie } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/account-tokens";
import { OAUTH_PENDING_COOKIE, type ProviderProfile, completeSignUp, unseal } from "@/lib/oauth";
import { clearShortCookie } from "@/lib/oauth-cookies";
import { errorResponse, isUniqueViolation, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Complete = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/, "3–30 characters: letters, digits, underscore"),
  displayName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(255).nullish(),
  isAgeVerified: z.literal(true, { errorMap: () => ({ message: "18+ age certification is required (18 U.S.C. § 2257)" }) }),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Accept the Terms of Service to continue" }) }),
});

/** Creates the account of a new Google / Facebook sign-in after the person certifies 18+ and accepts the terms. */
export async function POST(req: NextRequest) {
  try {
    const pending = unseal<{ profile: ProviderProfile; next: string }>(req.cookies.get(OAUTH_PENDING_COOKIE)?.value);
    if (!pending) return jsonError(410, "This sign-in expired. Start again.");
    const input = Complete.parse(await req.json());
    const { user, needsEmailVerification } = await completeSignUp(pending.profile, input);
    if (needsEmailVerification) await sendVerificationEmail(user);
    const response = NextResponse.json({ success: true, next: pending.next, needsEmailVerification }, { status: 201 });
    setSessionCookie(response, user);
    clearShortCookie(response, OAUTH_PENDING_COOKIE);
    return response;
  } catch (error) {
    if (isUniqueViolation(error)) return jsonError(409, "This username or e-mail is already taken");
    return errorResponse(error, "auth/oauth/complete");
  }
}
