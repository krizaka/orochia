import { NextRequest, NextResponse } from "next/server";
import { db, authIdentities } from "@orochia/db";
import { and, eq } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse, HttpError } from "@/lib/http";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Unlinks a connected OAuth provider identity from the signed-in account. */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    const { id } = await params;

    const rows = await db
      .delete(authIdentities)
      .where(and(eq(authIdentities.id, id), eq(authIdentities.userId, user.id)))
      .returning({ id: authIdentities.id });

    if (rows.length === 0) {
      throw new HttpError(404, "Identity not found");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "me/identities/[id]");
  }
}
