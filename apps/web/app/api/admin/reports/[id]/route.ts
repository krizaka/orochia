import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, complianceReports } from "@orochia/db";
import { eq } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Update = z.object({ status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED"]) });

/** Moves a report through triage (open → in review → resolved). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireUserWithRole(["ADMIN"]);
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Report not found");
    const { status } = Update.parse(await req.json());
    const [row] = await db
      .update(complianceReports)
      .set({ status, resolvedAt: status === "RESOLVED" ? new Date() : null })
      .where(eq(complianceReports.id, id.data))
      .returning({ id: complianceReports.id });
    if (!row) return jsonError(404, "Report not found");
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "admin/reports/patch");
  }
}
