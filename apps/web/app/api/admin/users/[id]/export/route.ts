import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { loadExportRows, shapeExport } from "@/lib/account-export";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Law 25 portability: everything held about an account, as one JSON document (never a password hash, a destination or a token). */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireUserWithRole(["ADMIN"]);
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Account not found");
    const rows = await loadExportRows(id.data);
    if (!rows) return jsonError(404, "Account not found");
    return NextResponse.json({ success: true, export: shapeExport(rows) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "admin/users/export");
  }
}
