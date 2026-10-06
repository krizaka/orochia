import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, payoutRequests } from "@orochia/db";
import { eq } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Update = z
  .object({
    status: z.enum(["UNDER_REVIEW", "PROCESSING", "SETTLED", "FAILED"]),
    txHashOrReference: z.string().trim().max(200).optional(),
    failureReason: z.string().trim().max(500).optional(),
  })
  .refine((u) => u.status !== "SETTLED" || !!u.txHashOrReference, {
    message: "A settled payout needs its transaction reference",
  })
  .refine((u) => u.status !== "FAILED" || !!u.failureReason, { message: "A failed payout needs a reason" });

const TERMINAL = new Set(["SETTLED", "FAILED"]);

/**
 * Advances a payout. Settled and failed are terminal: a failed payout's amount returns to the
 * creator's available balance (balances exclude failed payouts).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireUserWithRole(["ADMIN"]);
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Payout not found");
    const update = Update.parse(await req.json());
    const [current] = await db.select().from(payoutRequests).where(eq(payoutRequests.id, id.data)).limit(1);
    if (!current) return jsonError(404, "Payout not found");
    if (TERMINAL.has(current.status)) return jsonError(409, `Payout is already ${current.status.toLowerCase()}`);
    await db
      .update(payoutRequests)
      .set({
        status: update.status,
        txHashOrReference: update.txHashOrReference ?? current.txHashOrReference,
        failureReason: update.failureReason ?? null,
        reviewedAt: current.reviewedAt ?? new Date(),
        settledAt: update.status === "SETTLED" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(payoutRequests.id, id.data));
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "admin/payouts/patch");
  }
}
