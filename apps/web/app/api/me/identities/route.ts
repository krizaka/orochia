import { NextResponse } from "next/server";
import { db, authIdentities } from "@orochia/db";
import { eq } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Lists the external OAuth providers linked to the signed-in account. */
export async function GET() {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    const rows = await db
      .select({
        id: authIdentities.id,
        provider: authIdentities.provider,
        email: authIdentities.email,
        createdAt: authIdentities.createdAt,
        lastUsedAt: authIdentities.lastUsedAt,
      })
      .from(authIdentities)
      .where(eq(authIdentities.userId, user.id));

    return NextResponse.json({ success: true, identities: rows });
  } catch (error) {
    return errorResponse(error, "me/identities");
  }
}
