import { NextResponse } from "next/server";
import { db, users } from "@orochia/db";
import { and, eq } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Opens a creator space for a member: the account becomes CREATOR, pending its 18 U.S.C. § 2257 review
 * (uploads open once an operator verifies it). It keeps everything a member does — tipping, unlocking.
 */
export async function POST() {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    if (user.role !== "MEMBER") return NextResponse.json({ success: true, role: user.role });
    await db
      .update(users)
      .set({ role: "CREATOR", isVerified: false, updatedAt: new Date() })
      .where(and(eq(users.id, user.id), eq(users.role, "MEMBER")));
    return NextResponse.json({ success: true, role: "CREATOR", verificationPending: true });
  } catch (error) {
    return errorResponse(error, "me/become-creator");
  }
}
