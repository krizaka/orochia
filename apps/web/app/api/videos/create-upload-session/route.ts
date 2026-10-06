import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/redis";
import { BunnyStreamClient, CreateUploadSessionSchema } from "@orochia/media";
import { db, videos } from "@orochia/db";

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await getCurrentUser();
    if (!user || (user.role !== "CREATOR" && user.role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Forbidden: Only verified creators can upload video content." },
        { status: 403 }
      );
    }

    // 2. Rate limit check (e.g., max 10 upload sessions per hour)
    const rateLimit = await checkRateLimit(`upload_session:${user.id}`, 10, 3600);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many upload attempts. Please try again later." },
        { status: 429 }
      );
    }

    // 3. Validate request payload with Zod
    const body = await req.json();
    const parseResult = CreateUploadSessionSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // 4. Initialize Bunny Stream Client
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

    // 5. Generate Bunny Tus upload credentials
    const session = await bunnyClient.createTusUploadSession(input.title, 7200);

    // 6. Persist draft video entry in database
    const [videoRecord] = await db
      .insert(videos)
      .values({
        creatorId: user.id,
        bunnyVideoId: session.videoGuid,
        title: input.title,
        description: input.description,
        visibility: input.visibility,
        status: "PENDING_UPLOAD",
        minTipAmountCents: input.minTipAmountCents,
        tags: input.tags,
      })
      .returning();

    return NextResponse.json({
      success: true,
      videoId: videoRecord.id,
      session,
    });
  } catch (error: any) {
    console.error("Error creating upload session:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
