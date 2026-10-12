import { NextResponse } from "next/server";
import { db, users } from "@orochia/db";
import { and, eq } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse, HttpError } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Opens a creator space for a member: the same account becomes CREATOR, pending its 18 U.S.C. § 2257 review
 * (uploads open once an operator verifies it). It keeps everything a member does — tipping, unlocking. Refused
 * without a recorded date of birth (the server's 18+ check, `/api/me/birth-date`). docs/CREATOR_ONBOARDING.md.
 */
export async function POST() {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    if (user.role !== "MEMBER") return NextResponse.json({ success: true, role: user.role });
    const [account] = await db.select({ dateOfBirth: users.dateOfBirth }).from(users).where(eq(users.id, user.id)).limit(1);
    if (!account?.dateOfBirth) {
      throw new HttpError(403, "A date of birth is required before opening a creator space", { code: "BIRTH_DATE_REQUIRED" });
    }
    await db
      .update(users)
      .set({ role: "CREATOR", isVerified: false, updatedAt: new Date() })
      .where(and(eq(users.id, user.id), eq(users.role, "MEMBER")));
    return NextResponse.json({ success: true, role: "CREATOR", verificationPending: true });
  } catch (error) {
    return errorResponse(error, "me/become-creator");
  }
}
