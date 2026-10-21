import { NextResponse } from "next/server";

import { historyOf } from "@/lib/app-config-db";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The revisions of a platform, newest first, each with its reason and who published it. */
export async function GET(_req: Request, props: { params: Promise<{ platform: string }> }) {
  try {
    await requireUserWithRole(["ADMIN"]);
    return NextResponse.json({ data: await historyOf((await props.params).platform) });
  } catch (error) {
    return errorResponse(error, "admin/app-config/history");
  }
}
