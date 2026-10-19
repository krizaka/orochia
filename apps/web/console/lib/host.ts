/**
 * Two sites, one app: dev.orochia.com (the platform) and admin.orochia.com (the operator console, `app/console`). The
 * proxy decides by the host — pure here, so it is tested without a server. On the console host every address is the
 * console's (`/audit` is served by `/console/audit`) and nothing of the platform; on any other host `/console` does not
 * exist (404). The console host also answers only the addresses of AUTH_ALLOWED_IPS (gate.ts).
 */
export const CONSOLE_PREFIX = "/console";

/** admin.<anything>, with or without a port. Anything that merely contains "admin" elsewhere is not the console. */
export const isConsoleHost = (host: string | null | undefined): boolean => /^admin\./i.test(host?.trim() ?? "");

export type ConsoleRoute = { kind: "next" } | { kind: "rewrite"; path: string } | { kind: "notFound" };

/** The internal prefix typed by hand, on any host: the console's real address is never `/console/…`. */
const typedPrefix = (pathname: string) => pathname === CONSOLE_PREFIX || pathname.startsWith(`${CONSOLE_PREFIX}/`);

/** The tab icon the layout declares (`app/console/icon.svg`): the one file whose real address carries the prefix. */
const ICON = `${CONSOLE_PREFIX}/icon.svg`;

export function consoleRoute(host: string | null | undefined, pathname: string): ConsoleRoute {
  if (pathname === ICON && isConsoleHost(host)) return { kind: "rewrite", path: ICON };
  if (typedPrefix(pathname)) return { kind: "notFound" };
  if (!isConsoleHost(host)) return { kind: "next" };
  return { kind: "rewrite", path: pathname === "/" ? CONSOLE_PREFIX : `${CONSOLE_PREFIX}${pathname}` };
}
