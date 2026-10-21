import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { parsePublish } from "@/lib/app-config-admin";
import { bodyOfRevision, publish } from "@/lib/app-config-db";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Rollback = z.object({ revision: z.number().int().min(1), reason: z.string().trim().min(3).max(400) });

/** Publishes an earlier revision again, as a new one: the history is never rewritten. */
export async function POST(req: NextRequest, props: { params: Promise<{ platform: string }> }) {
  try {
    const operator = await requireUserWithRole(["ADMIN"]);
    const platform = (await props.params).platform;
    const { revision, reason } = Rollback.parse(await req.json());
    const body = await bodyOfRevision(platform, revision, reason);
    if (!body) return jsonError(404, `No revision ${revision} for ${platform}`);
    const parsed = parsePublish(platform, body);
    if (!parsed.ok) return jsonError(parsed.status, parsed.message);
    return NextResponse.json({ data: await publish(parsed.platform, parsed.value, operator.email) });
  } catch (error) {
    return errorResponse(error, "admin/app-config/rollback");
  }
}
