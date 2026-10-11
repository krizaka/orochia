import { db, hashPassword,profiles, users } from "@orochia/db";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { refuseAutomation } from "@/lib/abuse/automation";
import {
  assertEmailDomainAllowed,
  assertFormToken,
  assertHoneypot,
  DEVICE_COOKIE,
  DEVICE_COOKIE_MAX_AGE,
  isDeviceId,
  issueFormToken,
  newDeviceId,
} from "@/lib/abuse/signup-guard";
import { publicChallenge,requireChallenge } from "@/lib/abuse/turnstile";
import { sendVerificationEmail } from "@/lib/account-tokens";
import { setSessionCookie } from "@/lib/auth";
import { clientIp } from "@/lib/client-ip";
import { isDemoMode } from "@/lib/env";
import { errorResponse, isUniqueViolation, jsonError } from "@/lib/http";
import { acceptInvitation } from "@/lib/invitations";
import { checkDateOfBirth } from "@/lib/profile";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isReserved } from "@/lib/usernames";

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
  /** YYYY-MM-DD; refused under 18 (lib/profile.ts). */
  dateOfBirth: z.string().trim(),
  isAgeVerified: z.literal(true, {
    errorMap: () => ({ message: "18+ age certification is required (18 U.S.C. § 2257)" }),
  }),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "The terms must be accepted" }) }),
  /** From GET /api/auth/register: signed, bound to this device, at least a few seconds old (lib/abuse/signup-guard.ts). */
  formToken: z.string().max(200).optional(),
  /** The honeypot: hidden from people, filled by bots. */
  website: z.string().max(500).optional(),
  /** Cloudflare Turnstile's response, when the bot challenge is on (lib/abuse/turnstile.ts). */
  challengeToken: z.string().max(2048).optional(),
});

/**
 * Opens a sign-up form: a signed form token (bound to this browser's device cookie, set here when missing) and the
 * public bot-challenge settings — the form cannot be posted without them.
 */
export async function GET() {
  try {
    const jar = await cookies();
    const existing = jar.get(DEVICE_COOKIE)?.value;
    const deviceId = isDeviceId(existing) ? existing : newDeviceId();
    const response = NextResponse.json({ success: true, formToken: issueFormToken(deviceId), challenge: publicChallenge() });
    response.headers.set("Cache-Control", "no-store");
    if (deviceId !== existing) {
      response.cookies.set(DEVICE_COOKIE, deviceId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: DEVICE_COOKIE_MAX_AGE,
      });
    }
    return response;
  } catch (error) {
    return errorResponse(error, "auth/register/get");
  }
}

/**
 * Creates an account (a member — creators are opened later, never an administrator), signs it in and e-mails the link that
 * verifies its address — until then the account can do nothing else.
 */
export async function POST(req: NextRequest) {
  try {
    // Cheap checks first, the paid one (Cloudflare) last: an automated client, the per-IP and per-device limits,
    // the honeypot, the form token, a disposable address — then the bot challenge (fail closed).
    refuseAutomation(req.headers);
    const ip = clientIp(req.headers);
    await enforceRateLimit(`register:${ip ?? "unknown"}`, 5, 60 * 60, "Too many registrations. Try again later.");
    const deviceId = (await cookies()).get(DEVICE_COOKIE)?.value;
    if (isDeviceId(deviceId)) await enforceRateLimit(`register-device:${deviceId}`, 3, 24 * 60 * 60, "Too many registrations. Try again later.");

    const input = RegisterSchema.parse(await req.json());
    assertHoneypot(input.website);
    assertFormToken(input.formToken, deviceId);
    assertEmailDomainAllowed(input.email);
    await requireChallenge(input.challengeToken, { ip, failMode: "closed" });
    const dateOfBirth = checkDateOfBirth(input.dateOfBirth);
    if (isReserved(input.username)) return jsonError(400, "This username is reserved. Choose another one.");

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
          dateOfBirth,
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
