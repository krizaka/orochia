import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse, jsonError } from "@/lib/http";
import { registerDevice, unregisterDevice } from "@/lib/push";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const Device = z.object({ token: z.string().min(10).max(255), platform: z.enum(["ios", "android"]) });
const Forget = z.object({ token: z.string().min(10).max(255) });

/** Registers the phone the app runs on for push notifications (an Expo push token, moved if it served another account). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    if (!(await checkRateLimit(`push-device:${user.id}`, 20, 60 * 60)).success) return jsonError(429, "Too many requests");
    const { token, platform } = Device.parse(await req.json());
    if (!(await registerDevice(user.id, token, platform))) return jsonError(400, "Not a push token");
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "me/devices");
  }
}

/** Forgets one of the account's phones (sign-out, notifications turned off on the device). */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const { token } = Forget.parse(await req.json());
    await unregisterDevice(user.id, token);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "me/devices");
  }
}
