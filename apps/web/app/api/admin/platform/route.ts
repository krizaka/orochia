import { NextResponse } from "next/server";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { platformStatus } from "@/lib/platform";

export const dynamic = "force-dynamic";

/** The platform for operators: environment, database (size, rows per table), migration history, whether a reset is allowed. */
export async function GET() {
  try {
    await requireUserWithRole(["ADMIN"]);
    return NextResponse.json({ success: true, platform: await platformStatus() });
  } catch (error) {
    return errorResponse(error, "admin/platform");
  }
}
