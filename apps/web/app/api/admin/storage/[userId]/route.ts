import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserWithRole } from "@/lib/auth";
import { errorResponse, jsonError } from "@/lib/http";
import { setStoragePlan } from "@/lib/storage-usage";

export const dynamic = "force-dynamic";

const Body = z.object({
  /** A plan of ABUSE_QUOTA_PLANS ("pro", "unlimited"…), or null for the role's default plan. */
  plan: z.string().trim().max(40).nullable(),
});

/** Sets an account's storage plan (a name of ABUSE_QUOTA_PLANS, or null for the default); its held uploads go online if they fit. */
export async function PATCH(req: NextRequest, props: { params: Promise<{ userId: string }> }) {
  try {
    await requireUserWithRole(["ADMIN"]);
    const id = z.string().uuid().safeParse((await props.params).userId);
    if (!id.success) return jsonError(404, "Account not found");
    const { plan } = Body.parse(await req.json());
    return NextResponse.json({ success: true, ...(await setStoragePlan(id.data, plan)) });
  } catch (error) {
    return errorResponse(error, "admin/storage/plan");
  }
}
