import { NextResponse } from "next/server";
import { getPresetAssets } from "@/lib/presets";

export const dynamic = "force-dynamic";

/** Default avatar and banner presets users can choose without uploading custom files. */
export async function GET() {
  return NextResponse.json({ success: true, ...getPresetAssets() });
}
