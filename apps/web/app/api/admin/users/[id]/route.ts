import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, users } from "@orochia/db";
import { eq } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suspend"), reason: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal("reinstate") }),
  z.object({ action: z.literal("set-role"), role: z.enum(["ADMIN", "CREATOR", "MEMBER"]) }),
]);

/**
 * Suspends an account (it can no longer sign in, and its open sessions are refused on their next
 * request), reinstates it, or changes its role. An administrator cannot act on their own account.
 */
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const admin = await requireUserWithRole(["ADMIN"]);
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Account not found");
    if (id.data === admin.id) return jsonError(400, "You cannot change your own account here");
    const input = Action.parse(await req.json());
    const set =
      input.action === "suspend"
        ? { suspendedAt: new Date(), suspensionReason: input.reason }
        : input.action === "reinstate"
          ? { suspendedAt: null, suspensionReason: null }
          : { role: input.role };
    const [row] = await db.update(users).set({ ...set, updatedAt: new Date() }).where(eq(users.id, id.data)).returning({ id: users.id });
    if (!row) return jsonError(404, "Account not found");
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "admin/users/patch");
  }
}
