import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";
import { requestContact } from "@/lib/social";

export const dynamic = "force-dynamic";

const Request = z.object({ username: z.string().trim().min(2).max(50) });

/** Sends a contact request (accepted at once when the other person already asked). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const limit = await checkRateLimit(`contact:${user.id}`, 30, 60 * 60);
    if (!limit.success) return jsonError(429, "Too many requests. Try again later.");
    const { username } = Request.parse(await req.json());
    return NextResponse.json({ success: true, contact: await requestContact(user.id, username) }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "contacts/post");
  }
}
