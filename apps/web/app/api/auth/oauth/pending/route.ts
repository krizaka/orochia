import { NextRequest, NextResponse } from "next/server";
import { OAUTH_PENDING_COOKIE, type ProviderProfile, suggestUsername, unseal } from "@/lib/oauth";
import { freeUsername } from "@/lib/usernames";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The provider sign-in waiting to become an account: what the completion form can prefill. */
export async function GET(req: NextRequest) {
  const pending = unseal<{ profile: ProviderProfile }>(req.cookies.get(OAUTH_PENDING_COOKIE)?.value);
  if (!pending) return jsonError(404, "No sign-in to complete");
  const { profile } = pending;
  return NextResponse.json({
    success: true,
    provider: profile.provider,
    email: profile.email,
    needsEmail: !profile.email,
    displayName: profile.name ?? "",
    username: await freeUsername(suggestUsername(profile)),
    avatarUrl: profile.avatarUrl,
  });
}
