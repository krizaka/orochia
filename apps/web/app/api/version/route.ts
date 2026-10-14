import { NextResponse } from "next/server";

import { BUILD_INFO } from "@/lib/build-info";

export const dynamic = "force-dynamic";

/** What is deployed: the package version, the short commit and the environment (inlined at build). */
export async function GET() {
  return NextResponse.json({ ...BUILD_INFO }, { headers: { "Cache-Control": "no-store" } });
}
