import { NextResponse } from "next/server";
import { requireUserWithRole } from "@/lib/auth";
import { catalogueStats } from "@/lib/queries";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Catalogue statistics for administrators, from the database. */
export async function GET() {
  try {
    await requireUserWithRole(["ADMIN"]);
    return NextResponse.json({ success: true, data: await catalogueStats() });
  } catch (error) {
    return errorResponse(error, "analytics");
  }
}
