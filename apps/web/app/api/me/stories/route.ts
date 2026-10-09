import { NextResponse } from "next/server";
import { requireUserWithRole } from "@/lib/auth";
import { myStories } from "@/lib/stories";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Your stories of the last 30 days — up, encoding or expired — with their figures. */
export async function GET() {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    return NextResponse.json({ success: true, stories: await myStories(user.id) });
  } catch (error) {
    return errorResponse(error, "me/stories");
  }
}
