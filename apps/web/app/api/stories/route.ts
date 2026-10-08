import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, stories, users, profiles, videos } from "@orochia/db";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { signStoryMedia } from "@/lib/media-urls";
import { BunnyStreamClient } from "@orochia/media";
import { bunnyStreamConfig } from "@/lib/env";
import { errorResponse } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/stories
 * Lists active ephemeral stories (expires_at > now), with signed Bunny CDN media tokens.
 */
export async function GET() {
  try {
    const activeStories = await db
      .select({
        id: stories.id,
        creatorId: stories.creatorId,
        mediaType: stories.mediaType,
        bunnyVideoId: stories.bunnyVideoId,
        mediaUrl: stories.mediaUrl,
        thumbnailUrl: stories.thumbnailUrl,
        caption: stories.caption,
        visibility: stories.visibility,
        viewsCount: stories.viewsCount,
        likesCount: stories.likesCount,
        tipsCount: stories.tipsCount,
        expiresAt: stories.expiresAt,
        createdAt: stories.createdAt,
        creatorUsername: users.username,
        creatorDisplayName: profiles.displayName,
        creatorAvatarUrl: profiles.avatarUrl,
        isVerified: users.isVerified,
      })
      .from(stories)
      .innerJoin(users, eq(users.id, stories.creatorId))
      .leftJoin(profiles, eq(profiles.userId, stories.creatorId))
      .where(
        and(
          gt(stories.expiresAt, new Date()),
          isNull(stories.removedAt),
          isNull(users.suspendedAt)
        )
      )
      .orderBy(desc(stories.createdAt));

    const signed = activeStories.map((s) => {
      const media = signStoryMedia({
        mediaType: s.mediaType,
        mediaUrl: s.mediaUrl,
        thumbnailUrl: s.thumbnailUrl,
        bunnyVideoId: s.bunnyVideoId,
      });

      return {
        ...s,
        mediaUrl: media.mediaUrl,
        thumbnailUrl: media.thumbnailUrl,
      };
    });

    return NextResponse.json({ stories: signed });
  } catch (error) {
    return errorResponse(error, "stories/list");
  }
}

/**
 * POST /api/stories
 * Publishes an ephemeral 24h story for verified creators.
 * Supports:
 * 1) "VIDEO" with Bunny Stream (either videoId from existing upload or requesting Tus credentials)
 * 2) "IMAGE" with direct URL or uploaded media
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user (must be verified creator)
    const user = await getCurrentUser();
    if (!user || (user.role !== "CREATOR" && user.role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Forbidden: Only creators can publish stories." },
        { status: 403 }
      );
    }

    const [account] = await db
      .select({ isVerified: users.isVerified })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!account?.isVerified) {
      return NextResponse.json(
        { error: "Creator verification (18 U.S.C. § 2257) required to publish stories." },
        { status: 403 }
      );
    }

    // 2. Rate limit (max 20 stories per hour)
    const rateLimit = await checkRateLimit(`story_create:${user.id}`, 20, 3600);
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Story rate limit exceeded. Please wait before posting again." }, { status: 429 });
    }

    const body = await req.json();
    const { mediaType = "IMAGE", mediaUrl, thumbnailUrl, caption, visibility = "PUBLIC", bunnyVideoId, fromVideoId } = body;

    let finalMediaUrl = mediaUrl;
    let finalThumbnailUrl = thumbnailUrl;
    let finalBunnyVideoId = bunnyVideoId;

    // Optional: create story from an existing published video highlight
    if (fromVideoId) {
      const [existingVideo] = await db
        .select()
        .from(videos)
        .where(and(eq(videos.id, fromVideoId), eq(videos.creatorId, user.id)))
        .limit(1);

      if (existingVideo) {
        finalBunnyVideoId = existingVideo.bunnyVideoId;
        finalThumbnailUrl = existingVideo.thumbnailUrl;
        const config = bunnyStreamConfig();
        finalMediaUrl = `https://${config.hostname}/${existingVideo.bunnyVideoId}/playlist.m3u8`;
      }
    }

    if (!finalMediaUrl && !finalBunnyVideoId) {
      return NextResponse.json(
        { error: "Missing media: Provide mediaUrl or bunnyVideoId." },
        { status: 400 }
      );
    }

    // If video with bunnyVideoId but no mediaUrl, construct the stream URL
    if (finalBunnyVideoId && !finalMediaUrl) {
      const config = bunnyStreamConfig();
      finalMediaUrl = `https://${config.hostname}/${finalBunnyVideoId}/playlist.m3u8`;
      if (!finalThumbnailUrl) {
        finalThumbnailUrl = `https://${config.hostname}/${finalBunnyVideoId}/thumbnail.jpg`;
      }
    }

    // Set 24h expiration
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [created] = await db
      .insert(stories)
      .values({
        creatorId: user.id,
        mediaType: mediaType.toUpperCase() === "VIDEO" ? "VIDEO" : "IMAGE",
        bunnyVideoId: finalBunnyVideoId || null,
        mediaUrl: finalMediaUrl,
        thumbnailUrl: finalThumbnailUrl || null,
        caption: (caption || "").slice(0, 280),
        visibility: ["PUBLIC", "CONTACTS_ONLY", "SUBSCRIBERS_ONLY"].includes(visibility) ? visibility : "PUBLIC",
        expiresAt,
      })
      .returning();

    return NextResponse.json({ success: true, story: created });
  } catch (error) {
    return errorResponse(error, "stories/create");
  }
}
