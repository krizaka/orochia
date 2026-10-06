import { NextRequest, NextResponse } from "next/server";
import { signSessionToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = signSessionToken({
      id: body.id || "demo-user-id",
      username: body.username || "creator",
      email: body.email || "demo@orochia.org",
      role: body.role || "CREATOR",
      isAgeVerified: true,
    });

    const response = NextResponse.json({ success: true, user: body });
    response.cookies.set("orochia_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
