import { NextResponse } from "next/server";
import { requireUserWithRole } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";
import { listBackups } from "@/lib/backups";
import { backupDatabase } from "@/lib/platform";

export const dynamic = "force-dynamic";

/** The database backups kept in private storage, newest first. */
export async function GET() {
  try {
    await requireUserWithRole(["ADMIN"]);
    return NextResponse.json({ success: true, backups: await listBackups() });
  } catch (error) {
    return errorResponse(error, "admin/platform/backups");
  }
}

/** Backs the whole database up now (gzipped JSON of every table, in private storage). */
export async function POST() {
  try {
    const admin = await requireUserWithRole(["ADMIN"]);
    if (!(await checkRateLimit(`platform-backup:${admin.id}`, 10, 60 * 60)).success) return jsonError(429, "Too many backups. Try again later.");
    return NextResponse.json({ success: true, backup: await backupDatabase(admin.username) }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "admin/platform/backups/create");
  }
}
