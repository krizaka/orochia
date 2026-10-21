import { type NextRequest, NextResponse } from "next/server";

import { consoleRoute } from "./host";

export const ADMIN_COOKIE = "orochia_admin_session";

const NOINDEX = "noindex, nofollow";

/**
 * Two gates before any page or route of the console host, then the rewrite into `app/console`:
 * 1. Network — when AUTH_ALLOWED_IPS is set (comma-separated addresses), every other client gets 403, sign-in page
 *    included. The client address is DigitalOcean's `do-connecting-ip` (set by its edge, not by the client); locally,
 *    the first `x-forwarded-for` hop. In production the list is mandatory: without it the console answers 403 to all.
 *    Only `/api/health` (liveness, no data) and `/robots.txt` (`Disallow: /`) are outside it.
 * 2. Session — no operator cookie, back to /login (the session itself is checked against the console's database).
 * Returns null when the request is not the console's (the platform's proxy goes on).
 */
export function consoleGate(req: NextRequest): NextResponse | null {
  const route = consoleRoute(req.headers.get("host") ?? req.nextUrl.host, req.nextUrl.pathname);
  if (route.kind === "next") return null;
  if (route.kind === "notFound") return new NextResponse("Not found", { status: 404, headers: { "x-robots-tag": NOINDEX } });

  const { pathname } = req.nextUrl;
  const open = pathname === "/api/health" || pathname === "/robots.txt";
  if (!open && !allowed(clientIp(req))) return new NextResponse("Forbidden", { status: 403, headers: { "x-robots-tag": NOINDEX } });
  if (!open && !pathname.startsWith("/login") && !pathname.startsWith("/api/session") && !req.cookies.get(ADMIN_COOKIE)?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("x-robots-tag", NOINDEX);
    return redirect;
  }
  const url = req.nextUrl.clone();
  url.pathname = route.path;
  const response = NextResponse.rewrite(url);
  response.headers.set("x-robots-tag", NOINDEX);
  return response;
}

function clientIp(req: NextRequest): string | null {
  return req.headers.get("do-connecting-ip")?.trim() || (process.env.NODE_ENV === "production" ? null : req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1");
}

function allowed(ip: string | null): boolean {
  const list = (process.env.AUTH_ALLOWED_IPS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return process.env.NODE_ENV !== "production";
  return ip !== null && list.includes(ip);
}
