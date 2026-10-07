import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { addToList, listPeople, removeFromList } from "@/lib/audiences";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Add = z.object({ username: z.string().trim().min(1).max(51) });

async function context(params: Promise<{ id: string }>) {
  const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
  const id = z.string().uuid().safeParse((await params).id);
  return { user, id: id.success ? id.data : null };
}

/** The people in one of your lists. */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { user, id } = await context(props.params);
    if (!id) return jsonError(404, "List not found");
    return NextResponse.json({ success: true, members: await listPeople(user.id, id) });
  } catch (error) {
    return errorResponse(error, "me/lists/members/get");
  }
}

/** Adds an account to one of your lists by username (idempotent; the list stays private). */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { user, id } = await context(props.params);
    if (!id) return jsonError(404, "List not found");
    const limit = await checkRateLimit(`list-member:${user.id}`, 200, 60 * 60);
    if (!limit.success) return jsonError(429, "Too many requests. Try again later.");
    const { username } = Add.parse(await req.json());
    return NextResponse.json({ success: true, member: await addToList(user.id, id, username) }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "me/lists/members/post");
  }
}

/** Removes someone from one of your lists (`?userId=`): what the list opened closes to them. */
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { user, id } = await context(props.params);
    if (!id) return jsonError(404, "List not found");
    const userId = z.string().uuid().safeParse(req.nextUrl.searchParams.get("userId"));
    if (!userId.success) return jsonError(404, "Member not found");
    await removeFromList(user.id, id, userId.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "me/lists/members/delete");
  }
}
