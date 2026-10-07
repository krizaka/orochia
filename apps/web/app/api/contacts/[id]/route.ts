import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse, jsonError } from "@/lib/http";
import { decideContact, removeContact } from "@/lib/social";

export const dynamic = "force-dynamic";

const Decision = z.object({ action: z.enum(["accept", "reject", "block"]) });

/** Accepts or rejects a request addressed to you, or blocks the other person. */
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Contact not found");
    const { action } = Decision.parse(await req.json());
    await decideContact(user.id, id.data, action);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "contacts/patch");
  }
}

/** Removes a contact or withdraws a request (either side). */
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Contact not found");
    await removeContact(user.id, id.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "contacts/delete");
  }
}
