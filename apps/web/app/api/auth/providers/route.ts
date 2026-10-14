import { NextResponse } from "next/server";

import { signupEnabled } from "@/lib/features";
import { configuredProviders } from "@/lib/oauth";

export const dynamic = "force-dynamic";

/**
 * The public configuration the web app and the native app read: the sign-in providers this deployment offers (only
 * those whose keys are configured) and whether sign-up is open (`signupEnabled` — `AUTH_SIGNUP_ENABLED`).
 */
export async function GET() {
  return NextResponse.json({ success: true, providers: configuredProviders(), signupEnabled: signupEnabled() });
}
