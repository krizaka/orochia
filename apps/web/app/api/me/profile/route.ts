import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, profiles, users, videos } from "@orochia/db";
import { eq } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { BANNER_KINDS, resolveBannerChoice, videoBannerEnabled } from "@/lib/banner";
import { errorResponse, HttpError, jsonError } from "@/lib/http";
import { presenceSettingChanged } from "@/lib/presence";
import { SOCIAL_NETWORK_IDS, normalizeWebsite, parseNotificationsOff, parseSocialLinks, profileImageUrl, socialLinksView } from "@/lib/profile";

export const dynamic = "force-dynamic";

/** Every field is optional: each settings section saves only what it shows. */
const ProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  bio: z.string().trim().max(1000).optional(),
  /** A preset id, an uploaded file's reference (avatars/… or banners/…), the current picture, or null to remove it. */
  avatar: z.string().trim().max(1000).nullable().optional(),
  banner: z.string().trim().max(1000).nullable().optional(),
  /** A cover that moves (APP_VIDEO_BANNER): a 3-6 s moment of one of your own videos, or an ambient loop. Sending `banner` goes back to a still. */
  bannerVideo: z
    .object({
      kind: z.enum(BANNER_KINDS),
      videoId: z.string().uuid().nullable().optional(),
      startSeconds: z.number().min(0).max(86_400).nullable().optional(),
      endSeconds: z.number().min(0).max(86_400).nullable().optional(),
      ambientId: z.string().max(60).nullable().optional(),
    })
    .optional(),
  websiteUrl: z.string().trim().max(200).nullable().optional(),
  socialLinks: z.record(z.string().max(200).nullable()).optional(),
  directMessagePrivacy: z.enum(["EVERYONE", "CONTACTS_ONLY"]).optional(),
  /** Whether the account's circle sees it online (lib/presence-rules.ts); off, it sees nobody's presence either. */
  showPresence: z.boolean().optional(),
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
      bannerKind: profiles.bannerKind,
      bannerVideoId: profiles.bannerVideoId,
      bannerStartSeconds: profiles.bannerStartSeconds,
      bannerEndSeconds: profiles.bannerEndSeconds,
      bannerAmbientId: profiles.bannerAmbientId,
      websiteUrl: profiles.websiteUrl,
      socialLinks: profiles.socialLinks,
      emailsOff: profiles.emailsOff,
      inAppOff: profiles.inAppOff,
      emailFrequency: profiles.emailFrequency,
      directMessagePrivacy: profiles.directMessagePrivacy,
      showPresence: profiles.showPresence,
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
    if (input.banner !== undefined) {
      set.bannerUrl = profileImageUrl("banner", input.banner, current.bannerUrl);
      // Choosing or removing a still puts the cover back to a still.
      if (input.bannerVideo === undefined) Object.assign(set, { bannerKind: "image", bannerVideoId: null, bannerStartSeconds: null, bannerEndSeconds: null, bannerAmbientId: null });
    }
    if (input.bannerVideo !== undefined) {
      if (!videoBannerEnabled()) throw new HttpError(404, "Video covers are not available yet");
      const [video] = input.bannerVideo.videoId ? await db.select().from(videos).where(eq(videos.id, input.bannerVideo.videoId)).limit(1) : [];
      const resolved = resolveBannerChoice(input.bannerVideo, { userId: user.id, video: video ?? null });
      set.bannerKind = resolved.kind;
      set.bannerVideoId = resolved.videoId;
      set.bannerStartSeconds = resolved.startSeconds;
      set.bannerEndSeconds = resolved.endSeconds;
      set.bannerAmbientId = resolved.ambientId;
      // The still stays as the poster: the video's own thumbnail for a moment of a video.
      if (resolved.kind === "video_segment" && video?.thumbnailUrl) set.bannerUrl = video.thumbnailUrl;
    }
    if (input.websiteUrl !== undefined) set.websiteUrl = normalizeWebsite(input.websiteUrl);
    if (input.socialLinks !== undefined) set.socialLinks = parseSocialLinks(input.socialLinks);
    if (input.directMessagePrivacy !== undefined) set.directMessagePrivacy = input.directMessagePrivacy;
    if (input.showPresence !== undefined) set.showPresence = input.showPresence;
    if (input.emailsOff !== undefined) set.emailsOff = parseNotificationsOff(input.emailsOff);
    if (input.inAppOff !== undefined) set.inAppOff = parseNotificationsOff(input.inAppOff);
    if (input.emailFrequency !== undefined) set.emailFrequency = input.emailFrequency;
    if (input.payoutAddressCrypto !== undefined && user.role === "CREATOR") set.payoutAddressCrypto = input.payoutAddressCrypto || null;
    await db.update(profiles).set(set).where(eq(profiles.userId, user.id));
    if (input.showPresence !== undefined && input.showPresence !== (current.showPresence ?? true)) await presenceSettingChanged(user.id, input.showPresence);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "me/profile");
  }
}
