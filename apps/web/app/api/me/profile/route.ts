import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, profiles, users } from "@orochia/db";
import { eq } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse, jsonError } from "@/lib/http";
import { SOCIAL_NETWORK_IDS, normalizeWebsite, parseNotificationsOff, parseSocialLinks, profileImageUrl, socialLinksView } from "@/lib/profile";

export const dynamic = "force-dynamic";

/** Every field is optional: each settings section saves only what it shows. */
const ProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  bio: z.string().trim().max(1000).optional(),
  /** A preset id, an uploaded file's reference (avatars/… or banners/…), the current picture, or null to remove it. */
  avatar: z.string().trim().max(1000).nullable().optional(),
  banner: z.string().trim().max(1000).nullable().optional(),
  websiteUrl: z.string().trim().max(200).nullable().optional(),
  socialLinks: z.record(z.string().max(200).nullable()).optional(),
  directMessagePrivacy: z.enum(["EVERYONE", "CONTACTS_ONLY"]).optional(),
  emailsOff: z.array(z.string().max(40)).max(60).optional(),
  inAppOff: z.array(z.string().max(40)).max(60).optional(),
  emailFrequency: z.enum(["INSTANT", "HOURLY", "NONE"]).optional(),
  payoutAddressCrypto: z.string().trim().max(200).optional(),
  /** Creators: whether fans may dare them, and the smallest offer a dare may carry ($1 to $10,000). */
  challengeRequestsOff: z.boolean().optional(),
  challengeMinCents: z.number().int().min(100).max(1_000_000).optional(),
});

async function read(userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      isVerified: users.isVerified,
      isAgeVerified: users.isAgeVerified,
      dateOfBirth: users.dateOfBirth,
      displayName: profiles.displayName,
      bio: profiles.bio,
      avatarUrl: profiles.avatarUrl,
      bannerUrl: profiles.bannerUrl,
      websiteUrl: profiles.websiteUrl,
      socialLinks: profiles.socialLinks,
      emailsOff: profiles.emailsOff,
      inAppOff: profiles.inAppOff,
      emailFrequency: profiles.emailFrequency,
      directMessagePrivacy: profiles.directMessagePrivacy,
      payoutAddressCrypto: profiles.payoutAddressCrypto,
      challengeRequestsOff: profiles.challengeRequestsOff,
      challengeMinCents: profiles.challengeMinCents,
      updatedAt: profiles.updatedAt,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

/** Reads the signed-in user's own profile and settings (private fields included: e-mail, date of birth). */
export async function GET() {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    const row = await read(user.id);
    if (!row) return jsonError(404, "Profile not found");
    return NextResponse.json({
      success: true,
      profile: { ...row, socialLinks: row.socialLinks ?? {}, links: socialLinksView(row.socialLinks), networks: SOCIAL_NETWORK_IDS },
    });
  } catch (error) {
    return errorResponse(error, "me/profile");
  }
}

/** Updates the signed-in user's own profile and preferences (only the fields sent). */
export async function PUT(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    const input = ProfileSchema.parse(await req.json());
    const current = await read(user.id);
    if (!current) return jsonError(404, "Profile not found");
    const set: Partial<typeof profiles.$inferInsert> = { updatedAt: new Date() };
    if (input.displayName !== undefined) set.displayName = input.displayName;
    if (input.challengeRequestsOff !== undefined) set.challengeRequestsOff = input.challengeRequestsOff;
    if (input.challengeMinCents !== undefined) set.challengeMinCents = input.challengeMinCents;
    if (input.bio !== undefined) set.bio = input.bio || null;
    if (input.avatar !== undefined) set.avatarUrl = profileImageUrl("avatar", input.avatar, current.avatarUrl);
    if (input.banner !== undefined) set.bannerUrl = profileImageUrl("banner", input.banner, current.bannerUrl);
    if (input.websiteUrl !== undefined) set.websiteUrl = normalizeWebsite(input.websiteUrl);
    if (input.socialLinks !== undefined) set.socialLinks = parseSocialLinks(input.socialLinks);
    if (input.directMessagePrivacy !== undefined) set.directMessagePrivacy = input.directMessagePrivacy;
    if (input.emailsOff !== undefined) set.emailsOff = parseNotificationsOff(input.emailsOff);
    if (input.inAppOff !== undefined) set.inAppOff = parseNotificationsOff(input.inAppOff);
    if (input.emailFrequency !== undefined) set.emailFrequency = input.emailFrequency;
    if (input.payoutAddressCrypto !== undefined && user.role === "CREATOR") set.payoutAddressCrypto = input.payoutAddressCrypto || null;
    await db.update(profiles).set(set).where(eq(profiles.userId, user.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "me/profile");
  }
}
