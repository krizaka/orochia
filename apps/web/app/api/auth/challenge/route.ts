import { NextResponse } from "next/server";

import { publicChallenge } from "@/lib/abuse/turnstile";

export const dynamic = "force-dynamic";

/** The public bot-challenge settings (provider and site key), or null when protected forms need no challenge. */
export async function GET() {
  return NextResponse.json({ success: true, challenge: publicChallenge() }, { headers: { "Cache-Control": "no-store" } });
}
