import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { accountProfile } from "@/lib/queries";
import { isDemoMode } from "@/lib/env";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The signed-in account, or `user: null`. */
export async function GET() {
  try {
    const session = await getCurrentUser();
    const user = session ? await accountProfile(session) : null;
    return NextResponse.json({ user, demoMode: isDemoMode() });
  } catch (error) {
    return errorResponse(error, "auth/me");
  }
}
