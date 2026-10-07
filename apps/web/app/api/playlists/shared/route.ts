import { NextResponse } from "next/server";
import { requireUserWithRole } from "@/lib/auth";
import { sharedWithMe } from "@/lib/playlists";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Collections other accounts invited you to. */
export async function GET() {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    return NextResponse.json({ success: true, playlists: await sharedWithMe(user.id) });
  } catch (error) {
    return errorResponse(error, "playlists/shared/get");
  }
}
