import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, users, profiles, hashPassword } from "@orochia/db";
import { setSessionCookie } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/account-tokens";
import { acceptInvitation } from "@/lib/invitations";
import { isDemoMode } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, isUniqueViolation, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const RegisterSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,30}$/, "3–30 characters: letters, digits, underscore"),
  email: z.string().trim().toLowerCase().email().max(255),
  displayName: z.string().trim().min(1).max(80),
  password: z.string().min(10, "At least 10 characters").max(256),
  inviteCode: z.string().trim().optional(),
  isAgeVerified: z.literal(true, {
    errorMap: () => ({ message: "18+ age certification is required (18 U.S.C. § 2257)" }),
  }),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "The terms must be accepted" }) }),
});

/**
 * Creates an account (a member — creators are opened later, never an administrator), signs it in and e-mails the link that
 * verifies its address — until then the account can do nothing else.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const limit = await checkRateLimit(`register:${ip}`, 5, 60 * 60);
    if (!limit.success) return jsonError(429, "Too many registrations. Try again later.");

    const input = RegisterSchema.parse(await req.json());

    const account = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          username: input.username,
          email: input.email,
          passwordHash: hashPassword(input.password),
          // One kind of account: members watch, follow, tip and unlock; publishing is opened later
          // ("become a creator", /api/me/become-creator) behind the 2257 review.
          role: "MEMBER",
          isVerified: true,
          isAgeVerified: true,
        })
        .returning();
      await tx.insert(profiles).values({ userId: user.id, displayName: input.displayName });
      return user;
    });

    if (input.inviteCode) {
      await acceptInvitation(input.inviteCode, account.id).catch(() => undefined);
    }

    const link = await sendVerificationEmail(account);
    // Demo mode only (never production): the link is also returned, so the flow can be tested end to end.
    const devVerificationUrl = isDemoMode() ? link : undefined;
    const response = NextResponse.json({ success: true, verificationRequired: true, devVerificationUrl }, { status: 201 });
    setSessionCookie(response, {
      id: account.id,
      username: account.username,
      email: account.email,
      role: account.role,
      isAgeVerified: account.isAgeVerified,
      emailVerified: false,
    });
    return response;
  } catch (error) {
    if (isUniqueViolation(error)) return jsonError(409, "Username or e-mail already registered");
    return errorResponse(error, "auth/register");
  }
}
