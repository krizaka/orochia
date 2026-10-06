import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordTipAndUnlock, GatewayTypeSchema } from "@orochia/payments";
import { db, videos } from "@orochia/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const UnlockVideoRequestSchema = z.object({
  videoId: z.string().uuid("Valid video ID required"),
  amountCents: z.number().int().positive("Amount must be greater than 0"),
  gateway: GatewayTypeSchema,
  transactionRef: z.string().min(3),
  note: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required to tip and unlock videos" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parseResult = UnlockVideoRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { videoId, amountCents, gateway, transactionRef, note } = parseResult.data;

    // Fetch video to retrieve creator ID and verify minimum unlock threshold
    const [video] = await db
      .select()
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (amountCents < video.minTipAmountCents) {
      return NextResponse.json(
        {
          error: `Minimum tip to unlock is $${(video.minTipAmountCents / 100).toFixed(2)}`,
        },
        { status: 400 }
      );
    }

    // Atomically execute ledger transaction and issue access grant
    const result = await recordTipAndUnlock({
      senderId: user.id,
      creatorId: video.creatorId,
      videoId: video.id,
      grossAmountCents: amountCents,
      gateway,
      gatewayTransactionRef: transactionRef,
      note,
    });

    return NextResponse.json({
      success: true,
      message: "Video unlocked successfully",
      grantId: result.grantId,
      ledgerId: result.ledgerId,
    });
  } catch (error: any) {
    console.error("Error unlocking video:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process unlock request" },
      { status: 500 }
    );
  }
}
