import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, users } from "@orochia/db";
import { and, eq } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Update = z.object({ isVerified: z.boolean() });

/**
 * Records the outcome of a creator's 18 U.S.C. § 2257 review. Only a verified creator can open an
 * upload session.
 */
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireUserWithRole(["ADMIN"]);
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Creator not found");
    const { isVerified } = Update.parse(await req.json());
    const [row] = await db
      .update(users)
      .set({ isVerified, updatedAt: new Date() })
      .where(and(eq(users.id, id.data), eq(users.role, "CREATOR")))
      .returning({ id: users.id });
    if (!row) return jsonError(404, "Creator not found");
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "admin/creators/patch");
  }
}
