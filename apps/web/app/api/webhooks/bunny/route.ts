import { NextRequest, NextResponse } from "next/server";
import {
  verifyBunnyWebhookSignature,
  parseBunnyWebhookPayload,
  mapBunnyStatusToOrochia,
} from "@orochia/media";
import { db, videos } from "@orochia/db";
import { eq } from "drizzle-orm";
import { bunnyStreamConfig, bunnyWebhookSecret } from "@/lib/env";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("bunnycdn-signature") || req.headers.get("x-signature");
    const webhookSecret = bunnyWebhookSecret();

    // 1. Verify webhook signature
    const isValid = verifyBunnyWebhookSignature({
      rawBody,
      signatureHeader: signature,
      webhookSecret,
    });

    if (!isValid) {
      console.warn("Unauthorized Bunny webhook call: signature mismatch");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 2. Parse and validate JSON payload
    const payload = parseBunnyWebhookPayload(JSON.parse(rawBody));
    const targetStatus = mapBunnyStatusToOrochia(payload.Status);

    // 3. Locate and update video record by Bunny video GUID
    const [existingVideo] = await db
      .select()
      .from(videos)
      .where(eq(videos.bunnyVideoId, payload.VideoGuid))
      .limit(1);

    if (!existingVideo) {
      console.warn(`Webhook received for unknown video GUID: ${payload.VideoGuid}`);
      return NextResponse.json({ message: "Video not tracked" }, { status: 200 });
    }

    const { hostname } = bunnyStreamConfig();
    const generatedThumbnail =
      payload.ThumbnailUrl || `https://${hostname}/${payload.VideoGuid}/thumbnail.jpg`;
    const generatedPreview =
      payload.PreviewAnimationUrl || `https://${hostname}/${payload.VideoGuid}/preview.webp`;

    await db
      .update(videos)
      .set({
        status: targetStatus,
        durationSeconds: payload.Duration || existingVideo.durationSeconds,
        resolutions: payload.Resolutions || existingVideo.resolutions,
        thumbnailUrl: generatedThumbnail,
        previewAnimationUrl: generatedPreview,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, existingVideo.id));

    return NextResponse.json({
      success: true,
      videoId: existingVideo.id,
      status: targetStatus,
    });
  } catch (error) {
    return errorResponse(error, "webhooks/bunny");
  }
}
