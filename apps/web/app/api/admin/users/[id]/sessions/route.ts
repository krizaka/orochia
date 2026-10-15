import { db, users } from "@orochia/db";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserWithRole } from "@/lib/auth";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Ends every session of an account without suspending it (a lost phone, a doubt): a session token issued before this
 * moment opens nothing, on the web and in the app. The person signs in again; their account is untouched. An
 * administrator cannot do it to their own account here.
 */
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const admin = await requireUserWithRole(["ADMIN"]);
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Account not found");
    if (id.data === admin.id) return jsonError(400, "You cannot end your own sessions here");
    const endedAt = new Date();
    const [row] = await db.update(users).set({ sessionsValidAfter: endedAt, updatedAt: endedAt }).where(eq(users.id, id.data)).returning({ id: users.id });
    if (!row) return jsonError(404, "Account not found");
    return NextResponse.json({ success: true, endedAt: endedAt.toISOString() });
  } catch (error) {
    return errorResponse(error, "admin/users/sessions");
  }
}
