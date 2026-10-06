import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { evaluateVideoAccess } from "@/lib/access";
import { BunnyStreamClient } from "@orochia/media";
import { db, videos } from "@orochia/db";
import { eq, sql } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const videoId = params.id;
    const user = await getCurrentUser();

    // 1. Evaluate permissions via access control matrix
    const access = await evaluateVideoAccess(videoId, user?.id);

    if (!access.allowed) {
      return NextResponse.json(
        {
          allowed: false,
          reason: access.reason,
          minTipAmountCents: access.minTipAmountCents,
          videoTitle: access.videoTitle,
        },
        { status: 403 }
      );
    }

    // 2. Retrieve video details
    const [video] = await db
      .select()
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // 3. Initialize Bunny Stream SDK
    const apiKey = process.env.BUNNY_STREAM_API_KEY || "demo_bunny_api_key";
    const libraryId = parseInt(process.env.BUNNY_STREAM_LIBRARY_ID || "123456", 10);
    const hostname = process.env.BUNNY_STREAM_HOSTNAME || "vz-demo.b-cdn.net";
    const tokenAuthKey = process.env.BUNNY_STREAM_TOKEN_AUTH_KEY || "demo_token_auth_key";

    const bunnyClient = new BunnyStreamClient({
      apiKey,
      libraryId,
      hostname,
      tokenAuthKey,
    });

    // 4. Generate expiring HMAC-SHA256 signed HLS URL
    const signedToken = bunnyClient.getSignedStreamUrl(video.bunnyVideoId, 14400);

    // 5. Fire-and-forget view count increment
    db.update(videos)
      .set({ viewsCount: sql`${videos.viewsCount} + 1` })
      .where(eq(videos.id, videoId))
      .catch((err) => console.warn("Failed to increment views:", err));

    return NextResponse.json({
      allowed: true,
      videoId: video.id,
      title: video.title,
      streamUrl: signedToken.directM3u8Url,
      token: signedToken.token,
      expires: signedToken.expires,
    });
  } catch (error: any) {
    console.error("Error generating signed stream:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate stream" },
      { status: 500 }
    );
  }
}
