import { type NextRequest, NextResponse } from "next/server";

import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALE_HEADER, PATH_HEADER, stripLocalePrefix } from "./lib/locales";

/**
 * Orochia speaks English and French. An address with a language (`/fr/explore`, `/en/explore`) is the same page in that
 * language: the proxy takes the prefix off, hands the page its language in a header, and remembers it in the family's
 * cookie (`NEXT_LOCALE`) so the unprefixed links of the page keep it. An address without a language is served as the
 * reader chose (cookie), else as their browser asks (Accept-Language), else in English (lib/i18n-server.ts).
 * Every page also learns the address as asked (`x-pathname`) for its canonical and hreflang alternates.
 * The API, the media and Next's own files never pass here.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { locale, path } = stripLocalePrefix(pathname);
  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, path);
  headers.delete(LOCALE_HEADER);

  if (!locale) return NextResponse.next({ request: { headers } });

  headers.set(LOCALE_HEADER, locale);
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = search;
  const response = NextResponse.rewrite(url, { request: { headers } });
  if (!isLocale(request.cookies.get(LOCALE_COOKIE)?.value) || request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: "lax" });
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|.*\\.[a-zA-Z0-9]+$).*)"],
};
