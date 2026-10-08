import { NextResponse } from "next/server";
import { configuredProviders } from "@/lib/oauth";

export const dynamic = "force-dynamic";

/** The sign-in providers this deployment offers (only those whose keys are configured). */
export async function GET() {
  return NextResponse.json({ success: true, providers: configuredProviders() });
}
