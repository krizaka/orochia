import { NextResponse } from "next/server";
import { configuredGateways } from "@orochia/payments";
import { isDemoMode } from "@/lib/env";

export const dynamic = "force-dynamic";

/** The gateways a buyer can pay through on this deployment. */
export async function GET() {
  return NextResponse.json({ gateways: configuredGateways(), demoMode: isDemoMode() });
}
