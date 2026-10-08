import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { createInvitation, listUserInvitations } from "@/lib/invitations";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

const CreateInvitationSchema = z.object({
  email: z.string().trim().email(),
});

/** Lists invitations sent by the signed-in user. */
export async function GET() {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    const invitations = await listUserInvitations(user.id);
    return NextResponse.json({ success: true, invitations });
  } catch (error) {
    return errorResponse(error, "me/invitations");
  }
}

/** Sends an invitation to join Orochia to a friend or collaborator. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    const body = CreateInvitationSchema.parse(await req.json());
    const invitation = await createInvitation(user.id, body.email);
    return NextResponse.json({ success: true, invitation }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "me/invitations");
  }
}
