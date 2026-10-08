import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { setSessionCookie } from "@/lib/auth";
import { appUrl } from "@/lib/env";
import { HttpError } from "@/lib/http";
import {
  OAUTH_PENDING_COOKIE,
  OAUTH_PROVIDERS,
  OAUTH_STATE_COOKIE,
  type OAuthState,
  fetchProfile,
  resolveSignIn,
  seal,
  unseal,
} from "@/lib/oauth";
import { clearShortCookie, setShortCookie } from "@/lib/oauth-cookies";

export const dynamic = "force-dynamic";

const back = (reason: string) => NextResponse.redirect(`${appUrl()}/auth/login?error=${reason}`);

/**
 * The provider's redirect: checks the state, exchanges the code, then signs in (linked account or same
 * verified address) or sends a new person to complete their account.
 */
export async function GET(req: NextRequest, props: { params: Promise<{ provider: string }> }) {
  const provider = z.enum(OAUTH_PROVIDERS).safeParse((await props.params).provider);
  if (!provider.success) return back("provider");
  const saved = unseal<OAuthState>(req.cookies.get(OAUTH_STATE_COOKIE)?.value);
  const state = req.nextUrl.searchParams.get("state") ?? "";
  const code = req.nextUrl.searchParams.get("code");
  if (req.nextUrl.searchParams.get("error") || !code) return back("cancelled");
  if (
    !saved ||
    saved.provider !== provider.data ||
    saved.state.length !== state.length ||
    !crypto.timingSafeEqual(Buffer.from(saved.state), Buffer.from(state))
  ) {
    return back("state");
  }

  try {
    const profile = await fetchProfile(provider.data, code, saved.verifier);
    const outcome = await resolveSignIn(profile);
    if (outcome.kind === "signedIn") {
      const response = NextResponse.redirect(`${appUrl()}${saved.next}`);
      setSessionCookie(response, outcome.user);
      clearShortCookie(response, OAUTH_STATE_COOKIE);
      return response;
    }
    const response = NextResponse.redirect(`${appUrl()}/auth/complete`);
    setShortCookie(response, OAUTH_PENDING_COOKIE, seal({ profile, next: saved.next }, 900), 900);
    clearShortCookie(response, OAUTH_STATE_COOKIE);
    return response;
  } catch (error) {
    if (error instanceof HttpError && error.status === 403) return back("suspended");
    console.error("[auth/oauth/callback]", error);
    return back("provider");
  }
}
