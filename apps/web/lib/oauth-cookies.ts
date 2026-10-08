import type { NextResponse } from "next/server";
import { isProduction } from "./env";

/** httpOnly, SameSite=Lax (the provider redirects back with a top-level GET), Secure in production. */
export function setShortCookie(response: NextResponse, name: string, value: string, maxAge: number) {
  response.cookies.set(name, value, { httpOnly: true, secure: isProduction(), sameSite: "lax", path: "/", maxAge });
}

export function clearShortCookie(response: NextResponse, name: string) {
  response.cookies.set(name, "", { httpOnly: true, secure: isProduction(), sameSite: "lax", path: "/", maxAge: 0 });
}
