import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { LIST_NAME_MAX, createList, myLists } from "@/lib/audiences";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Create = z.object({ name: z.string().trim().min(1).max(LIST_NAME_MAX) });

/** Your reusable audience lists (private to you), with their size. */
export async function GET() {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    return NextResponse.json({ success: true, lists: await myLists(user.id) });
  } catch (error) {
    return errorResponse(error, "me/lists/get");
  }
}

/** Creates an audience list (names are unique per account). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const limit = await checkRateLimit(`list:${user.id}`, 30, 60 * 60);
    if (!limit.success) return jsonError(429, "Too many requests. Try again later.");
    const { name } = Create.parse(await req.json());
    return NextResponse.json({ success: true, list: await createList(user.id, name) }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "me/lists/post");
  }
}
