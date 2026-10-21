import { NextRequest, NextResponse } from "next/server";

import { parsePublish } from "@/lib/app-config-admin";
import { publish } from "@/lib/app-config-db";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Publishes the parameters of a platform as its next revision, with a reason; the history keeps every one. */
export async function PUT(req: NextRequest, props: { params: Promise<{ platform: string }> }) {
  try {
    const operator = await requireUserWithRole(["ADMIN"]);
    const parsed = parsePublish((await props.params).platform, await req.json().catch(() => null));
    if (!parsed.ok) return jsonError(parsed.status, parsed.message);
    return NextResponse.json({ data: await publish(parsed.platform, parsed.value, operator.email) });
  } catch (error) {
    return errorResponse(error, "admin/app-config/publish");
  }
}
