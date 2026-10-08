import { NextResponse } from "next/server";
import { paymentMethods } from "@orochia/payments";
import { isDemoMode } from "@/lib/env";

export const dynamic = "force-dynamic";

/** The ways a buyer can pay on this deployment: credits (the wallet), then the external gateways. */
export async function GET() {
  return NextResponse.json({ gateways: paymentMethods(), demoMode: isDemoMode() });
}
