import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OAUTH_PROVIDERS, OAUTH_STATE_COOKIE, startAuthorization } from "@/lib/oauth";
import { setShortCookie } from "@/lib/oauth-cookies";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Sends the browser to the provider's consent page (state + PKCE kept in a signed 10-minute cookie). */
export async function GET(req: NextRequest, props: { params: Promise<{ provider: string }> }) {
  try {
    const provider = z.enum(OAUTH_PROVIDERS).safeParse((await props.params).provider);
    if (!provider.success) return jsonError(404, "Sign-in provider not available");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await checkRateLimit(`oauth:${ip}`, 30, 15 * 60)).success) return jsonError(429, "Too many attempts. Try again later.");
    const { url, cookie } = startAuthorization(provider.data, req.nextUrl.searchParams.get("next"));
    const response = NextResponse.redirect(url);
    setShortCookie(response, OAUTH_STATE_COOKIE, cookie, 600);
    return response;
  } catch (error) {
    return errorResponse(error, "auth/oauth/start");
  }
}
