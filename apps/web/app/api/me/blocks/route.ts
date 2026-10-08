import { NextResponse } from "next/server";
import { requireUserWithRole } from "@/lib/auth";
import { listBlockedUsers } from "@/lib/messaging";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Lists the accounts blocked by the signed-in user. */
export async function GET() {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    const blocked = await listBlockedUsers(user.id);
    return NextResponse.json({ success: true, blocked });
  } catch (error) {
    return errorResponse(error, "me/blocks");
  }
}
