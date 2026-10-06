import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, complianceReports } from "@orochia/db";
import { desc, eq } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

const Status = z.enum(["OPEN", "IN_REVIEW", "RESOLVED"]);

/** Content reports, newest first; `?status=` filters. Suspected minors and non-consensual first. */
export async function GET(req: NextRequest) {
  try {
    await requireUserWithRole(["ADMIN"]);
    const status = Status.safeParse(new URL(req.url).searchParams.get("status"));
    const rows = await db
      .select()
      .from(complianceReports)
      .where(status.success ? eq(complianceReports.status, status.data) : undefined)
      .orderBy(desc(complianceReports.createdAt))
      .limit(200);
    const priority = (reason: string) => (reason === "UNDERAGE" ? 0 : reason === "NON_CONSENSUAL" ? 1 : 2);
    rows.sort((a, b) => priority(a.reason) - priority(b.reason));
    return NextResponse.json({ success: true, reports: rows });
  } catch (error) {
    return errorResponse(error, "admin/reports");
  }
}
