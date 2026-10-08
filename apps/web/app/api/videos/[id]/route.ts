import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, videos, auctions } from "@orochia/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse, jsonError } from "@/lib/http";
import { CREATOR_DELETED } from "@/lib/queries";

export const dynamic = "force-dynamic";

const Patch = z
  .object({
    title: z.string().trim().min(3).max(255).optional(),
    description: z.string().trim().max(5000).nullish(),
    visibility: z.enum(["PUBLIC", "CONTACTS_ONLY", "APPROVED_FOLLOWERS_ONLY", "TIPPED_UNLOCKED", "INVITED_ONLY"]).optional(),
    minTipAmountCents: z.number().int().min(0).max(100_000).optional(),
    tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(12).optional(),
    commentsEnabled: z.boolean().optional(),
  })
  .refine((p) => p.visibility !== "TIPPED_UNLOCKED" || p.minTipAmountCents === undefined || p.minTipAmountCents >= 100, {
    message: "A paid unlock costs at least $1.00",
    path: ["minTipAmountCents"],
  });

/** The creator edits their video (an auctioned video keeps its audience): title, description, visibility, unlock price, tags, comments open. */
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireUserWithRole(["CREATOR"]);
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Video not found");
    const patch = Patch.parse(await req.json());
    if (patch.visibility !== undefined || patch.minTipAmountCents !== undefined) {
      // While a video is in an auction (or sold at one), the auction decides who watches it.
      const [current] = await db.select({ visibility: videos.visibility }).from(videos).where(and(eq(videos.id, id.data), eq(videos.creatorId, user.id))).limit(1);
      if (current?.visibility === "AUCTION") return jsonError(409, "This video is in an auction: its audience is the auction's winner");
    }
    const [row] = await db
      .update(videos)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(videos.id, id.data), eq(videos.creatorId, user.id), isNull(videos.removedAt)))
      .returning({ id: videos.id });
    if (!row) return jsonError(404, "Video not found");
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "videos/patch");
  }
}

/**
 * The creator deletes their video (refused while it is in an auction). It is withdrawn everywhere (feed, playlists, playback) but the
 * row stays: ledger entries and access grants reference it and financial records are immutable.
 */
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireUserWithRole(["CREATOR"]);
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Video not found");
    const [auctioned] = await db.select({ id: auctions.id }).from(auctions).where(and(eq(auctions.videoId, id.data), inArray(auctions.status, ["OPEN", "AWAITING_DECISION"]))).limit(1);
    if (auctioned) return jsonError(409, "This video is in an auction: cancel or close the auction first");
    const [row] = await db
      .update(videos)
      .set({ removedAt: new Date(), removalReason: CREATOR_DELETED, updatedAt: new Date() })
      .where(and(eq(videos.id, id.data), eq(videos.creatorId, user.id), isNull(videos.removedAt)))
      .returning({ id: videos.id });
    if (!row) return jsonError(404, "Video not found");
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "videos/delete");
  }
}
