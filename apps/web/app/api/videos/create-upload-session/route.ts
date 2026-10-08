import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { BunnyStreamClient, CreateUploadSessionSchema } from "@orochia/media";
import { db, videos, users } from "@orochia/db";
import { eq } from "drizzle-orm";
import { requireBunnyStream } from "@/lib/env";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

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

    // 1b. 18 U.S.C. § 2257: a creator publishes only once the custodian review verified them.
    const [account] = await db.select({ isVerified: users.isVerified }).from(users).where(eq(users.id, user.id)).limit(1);
    if (!account?.isVerified) {
      return NextResponse.json(
        { error: "Creator verification (18 U.S.C. § 2257 records) is pending." },
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

    // 4. Bunny Stream client (credentials are mandatory in production)
    const bunnyClient = new BunnyStreamClient(requireBunnyStream());

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
  } catch (error) {
    return errorResponse(error, "videos/create-upload-session");
  }
}
