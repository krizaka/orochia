import { NextRequest, NextResponse } from "next/server";
import { requireUserWithRole } from "@/lib/auth";
import { readPrivateFile } from "@/lib/storage";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** A creator's 2257 document (`?ref=private/documents/<uuid>.<ext>`), for operators only; never cached. */
export async function GET(req: NextRequest) {
  try {
    await requireUserWithRole(["ADMIN"]);
    const file = await readPrivateFile(req.nextUrl.searchParams.get("ref") ?? "");
    if (!file) return jsonError(404, "Document not found");
    return new NextResponse(new Uint8Array(file.body), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error, "admin/documents");
  }
}
