import { NextRequest, NextResponse } from "next/server";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { deleteBackup, describeBackup, readBackup } from "@/lib/backups";

export const dynamic = "force-dynamic";

/** Downloads a backup file (`?download=1`), or describes it: tables, rows, migrations. */
export async function GET(req: NextRequest, props: { params: Promise<{ name: string }> }) {
  try {
    await requireUserWithRole(["ADMIN"]);
    const { name } = await props.params;
    if (req.nextUrl.searchParams.get("download") !== "1") return NextResponse.json({ success: true, backup: await describeBackup(name) });
    const body = await readBackup(name);
    return new Response(new Uint8Array(body), {
      headers: { "Content-Type": "application/gzip", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error, "admin/platform/backups/get");
  }
}

/** Deletes a backup from private storage. */
export async function DELETE(_req: NextRequest, props: { params: Promise<{ name: string }> }) {
  try {
    await requireUserWithRole(["ADMIN"]);
    await deleteBackup((await props.params).name);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "admin/platform/backups/delete");
  }
}
