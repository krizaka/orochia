import { NextResponse } from "next/server";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { network } from "@/lib/social";

export const dynamic = "force-dynamic";

/** Your followers, the creators you follow, your contacts and pending requests. */
export async function GET() {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    return NextResponse.json({ success: true, data: await network(user.id) });
  } catch (error) {
    return errorResponse(error, "me/network");
  }
}
