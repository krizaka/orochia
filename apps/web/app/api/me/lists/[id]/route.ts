import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { LIST_NAME_MAX, deleteList, renameList } from "@/lib/audiences";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Rename = z.object({ name: z.string().trim().min(1).max(LIST_NAME_MAX) });

/** Renames one of your lists. */
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const id = z.string().uuid().safeParse((await props.params).id);
    if (!id.success) return jsonError(404, "List not found");
    await renameList(user.id, id.data, Rename.parse(await req.json()).name);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "me/lists/patch");
  }
}

/** Deletes one of your lists; the videos and collections it opened close to its members. */
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const id = z.string().uuid().safeParse((await props.params).id);
    if (!id.success) return jsonError(404, "List not found");
    await deleteList(user.id, id.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "me/lists/delete");
  }
}
