import { NextResponse } from "next/server";

import { requireUserWithRole } from "@/lib/auth";
import { creatorTagHistory } from "@/lib/explore";
import { errorResponse } from "@/lib/http";
import { CURATED_TAGS } from "@/lib/tags";

export const dynamic = "force-dynamic";

/** The creator's tag suggestions for the publish form: the tags they used before (most used first) and the curated list. */
export async function GET() {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    return NextResponse.json({ success: true, previous: await creatorTagHistory(user.id), curated: CURATED_TAGS });
  } catch (error) {
    return errorResponse(error, "me/tags");
  }
}
