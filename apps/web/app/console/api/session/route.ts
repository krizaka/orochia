import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { ADMIN_COOKIE, audit, sessionCookie, signIn, signOut } from "@/console/lib/account";

export const dynamic = "force-dynamic";

const attempts = new Map<string, { count: number; resetAt: number }>();

/** Operator sign-in: the console's single account (AUTH_OPERATOR_EMAIL / AUTH_OPERATOR_PASSWORD). Ten attempts per 15 minutes and IP. */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("do-connecting-ip")?.trim() || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const entry = attempts.get(ip);
  const window = entry && entry.resetAt > now ? entry : { count: 0, resetAt: now + 15 * 60_000 };
  window.count += 1;
  attempts.set(ip, window);
  if (window.count > 10) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });

  const { email, password } = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  if (!email || !password) return NextResponse.json({ error: "E-mail and password are required" }, { status: 400 });
  try {
    const token = await signIn(email, password);
    if (!token) {
      await audit("sign-in", email.slice(0, 200), "refused", ip);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    await audit("sign-in", null, "ok", ip, { actor: email.slice(0, 200) });
    const response = NextResponse.json({ success: true });
    response.cookies.set(sessionCookie(token));
    return response;
  } catch (error) {
    console.error("[admin] sign-in failed", error);
    return NextResponse.json({ error: "The console is not configured (database or AUTH_OPERATOR_* variables)" }, { status: 503 });
  }
}

/** Sign-out: the session is deleted on the server, not only forgotten by the browser. */
export async function DELETE() {
  await signOut((await cookies()).get(ADMIN_COOKIE)?.value).catch(() => undefined);
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
