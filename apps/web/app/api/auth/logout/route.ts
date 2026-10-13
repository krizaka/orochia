import { NextResponse } from "next/server";
import { clearSessionCookie, revokeCurrentSession } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Signs out: the request's session token — a native app's bearer or the browser's cookie — is revoked on the server
 * (krizaka/orochia#127), so no surviving copy of it opens the account again; the browser's cookie is cleared too.
 */
export async function POST() {
  try {
    await revokeCurrentSession();
    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return errorResponse(error, "auth/logout");
  }
}
