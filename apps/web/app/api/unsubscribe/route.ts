import { NextRequest, NextResponse } from "next/server";

import { limitAction } from "@/lib/rate-limit";
import { unsubscribeCategory, verifyUnsubscribe } from "@/lib/unsubscribe";

export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe for one category of e-mail. The signed token is the authorisation (no session: it is opened from
 * an e-mail). A mail client posts `List-Unsubscribe=One-Click` (RFC 8058) and gets 200; the page's button posts a form and
 * is sent back to the page, which says it is done.
 */
export async function POST(req: NextRequest) {
  await limitAction("unsubscribe", req, null, { perIp: [60, 60 * 60] });
  const form = await req.formData().catch(() => null);
  const token = req.nextUrl.searchParams.get("t") ?? String(form?.get("t") ?? "");
  const who = verifyUnsubscribe(token);
  if (!who || !(await unsubscribeCategory(who.userId, who.category))) return NextResponse.json({ success: false }, { status: 400 });
  const fromPage = (req.headers.get("accept") ?? "").includes("text/html");
  return fromPage ? NextResponse.redirect(new URL(`/unsubscribe?done=1&t=${encodeURIComponent(token)}`, req.url), 303) : NextResponse.json({ success: true });
}
