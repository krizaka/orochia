import { db, users,videos } from "@orochia/db";
import { BunnyStreamClient, CreateUploadSessionSchema } from "@orochia/media";
import { eq } from "drizzle-orm";
import { after, NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { requireBunnyStream } from "@/lib/env";
import { errorResponse } from "@/lib/http";
import { limitAction } from "@/lib/rate-limit";
import { assertUploadAllowed, checkPlatformAlerts } from "@/lib/storage-usage";
import { normalizeTags } from "@/lib/tags";

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

    // 2. Rate limits, per account and per IP (Retry-After on refusal)
    await limitAction("upload-session", req, user.id, { perUser: [10, 3600], perIp: [30, 3600] }, "Too many upload attempts. Please try again later.");

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

    // 3b. Storage quotas, BEFORE anything is signed: the declared size (and length) against the per-file maximum,
    // the creator's plan, the platform's cap and the daily / concurrent counts (lib/storage-usage.ts).
    await assertUploadAllowed(user.id, { kind: "video", sizeBytes: input.sizeBytes, durationSeconds: input.durationSeconds });

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
        // The declared size until Bunny reports the real one (webhook, reconciliation).
        storageBytes: input.sizeBytes,
        minTipAmountCents: input.minTipAmountCents,
        // One spelling per idea (lower case, no accent, synonyms folded, no duplicate): /explore?tag= finds it.
        tags: normalizeTags(input.tags),
        contentRatingId: input.contentRatingId || null,
        isBlurred: input.isBlurred || false,
      })
      .returning();

    after(() => checkPlatformAlerts());
    return NextResponse.json({
      success: true,
      videoId: videoRecord.id,
      session,
    });
  } catch (error) {
    return errorResponse(error, "videos/create-upload-session");
  }
}
