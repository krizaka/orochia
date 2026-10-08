import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cancelAuction } from "@orochia/payments";
import { requireUserWithRole } from "@/lib/auth";
import { announceClose, auctionHttpError, auctionIdOr404 } from "@/lib/auctions";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Cancel = z.object({ reason: z.string().trim().min(3).max(500) });

/** Cancels an auction that is open or awaiting its decision, with a recorded reason; the leading bid is released. */
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    await requireUserWithRole(["ADMIN"]);
    const id = auctionIdOr404((await props.params).id);
    const { reason } = Cancel.parse(await req.json());
    const result = await cancelAuction({ auctionId: id, byOperator: true, reason });
    await announceClose({ kind: "CANCELLED", ...result });
    return NextResponse.json({ success: true });
  } catch (error) {
    const known = auctionHttpError(error);
    if (known) return jsonError(known.status, known.message, known.extra);
    return errorResponse(error, "admin/auctions/cancel");
  }
}
