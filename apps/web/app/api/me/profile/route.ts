import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, profiles } from "@orochia/db";
import { eq } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

const ProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(1000).optional().default(""),
  payoutAddressCrypto: z.string().trim().max(200).optional().default(""),
});

/** Updates the signed-in user's own profile. */
export async function PUT(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    const input = ProfileSchema.parse(await req.json());
    await db
      .update(profiles)
      .set({
        displayName: input.displayName,
        bio: input.bio || null,
        payoutAddressCrypto: user.role === "CREATOR" ? input.payoutAddressCrypto || null : null,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, user.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "me/profile");
  }
}
