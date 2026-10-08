import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, profiles, users } from "@orochia/db";
import { eq } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

const ProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(1000).optional().default(""),
  avatarUrl: z.string().trim().max(1000).nullable().optional(),
  bannerUrl: z.string().trim().max(1000).nullable().optional(),
  websiteUrl: z.string().trim().max(200).nullable().optional(),
  twitterHandle: z.string().trim().max(100).nullable().optional(),
  payoutAddressCrypto: z.string().trim().max(200).optional().default(""),
  directMessagePrivacy: z.enum(["EVERYONE", "CONTACTS_ONLY"]).optional().default("EVERYONE"),
});

/** Reads the signed-in user's own profile and settings. */
export async function GET() {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    const [row] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        isVerified: users.isVerified,
        isAgeVerified: users.isAgeVerified,
        displayName: profiles.displayName,
        bio: profiles.bio,
        avatarUrl: profiles.avatarUrl,
        bannerUrl: profiles.bannerUrl,
        websiteUrl: profiles.websiteUrl,
        twitterHandle: profiles.twitterHandle,
        directMessagePrivacy: profiles.directMessagePrivacy,
        payoutAddressCrypto: profiles.payoutAddressCrypto,
        updatedAt: profiles.updatedAt,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.id, user.id))
      .limit(1);

    return NextResponse.json({ success: true, profile: row });
  } catch (error) {
    return errorResponse(error, "me/profile");
  }
}

/** Updates the signed-in user's own profile and preferences. */
export async function PUT(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    const input = ProfileSchema.parse(await req.json());
    await db
      .update(profiles)
      .set({
        displayName: input.displayName,
        bio: input.bio || null,
        avatarUrl: input.avatarUrl || null,
        bannerUrl: input.bannerUrl || null,
        websiteUrl: input.websiteUrl || null,
        twitterHandle: input.twitterHandle ? input.twitterHandle.replace(/^@/, "") : null,
        directMessagePrivacy: input.directMessagePrivacy,
        payoutAddressCrypto: user.role === "CREATOR" ? input.payoutAddressCrypto || null : null,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, user.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "me/profile");
  }
}
