import { type NextRequest, NextResponse } from "next/server";

import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALE_HEADER, localeOf, PATH_HEADER, stripLocalePrefix } from "./lib/locales";

/**
 * Orochia speaks English and French, and every page lives at an address per language (`/en/explore`, `/fr/explore`):
 * the pages are generated once per language and stay static. An address with a language is served as it is, and the
 * choice is remembered in the family's cookie (`NEXT_LOCALE`). An address without one (the old links, the mobile app's,
 * the links inside the pages) is served as the reader chose (cookie), else as their browser asks (Accept-Language), else
 * in English — as that language's page, without a redirect hop. Every page also learns the address as asked (`x-pathname`).
 * The API, the media, Next's own files and the native bot-challenge page never pass here.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { locale: asked, path } = stripLocalePrefix(pathname);
  const headers = new Headers(request.headers);
  headers.delete(LOCALE_HEADER);
  headers.set(PATH_HEADER, path);
  const locale = asked ?? localeOf(headers);
  headers.set(LOCALE_HEADER, locale);

  let response: NextResponse;
  if (asked) {
    response = NextResponse.next({ request: { headers } });
  } else {
    const url = request.nextUrl.clone();
    url.pathname = path === "/" ? `/${locale}` : `/${locale}${path}`;
    url.search = search;
    response = NextResponse.rewrite(url, { request: { headers } });
  }
  const chosen = request.cookies.get(LOCALE_COOKIE)?.value;
  if (asked && (!isLocale(chosen) || chosen !== asked)) {
    response.cookies.set(LOCALE_COOKIE, asked, { path: "/", maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: "lax" });
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|\\.well-known|auth/native-challenge|.*\\.[a-zA-Z0-9]+$).*)"],
};
