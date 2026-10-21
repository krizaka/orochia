import { NextResponse } from "next/server";

import { listConfigs } from "@/lib/app-config-db";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The parameters of every platform (the console's App versions screen). */
export async function GET() {
  try {
    await requireUserWithRole(["ADMIN"]);
    return NextResponse.json({ data: await listConfigs() });
  } catch (error) {
    return errorResponse(error, "admin/app-config/list");
  }
}
