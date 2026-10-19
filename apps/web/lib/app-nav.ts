import type { MessageKey } from "./i18n";

/**
 * The destinations of the signed-in and public app shell, as data: the rail (@krizaka/ui `RailNav`: a column on a
 * desktop, the bottom tab bar on a phone) and the account menu. Words are messages (`nav.*`), keyed by the same ids.
 */

/** The rail's main destinations (a phone's bar holds five: these four plus Create at the foot). */
export const RAIL_ITEMS = [
  { id: "home", href: "/", labelKey: "nav.home" },
  { id: "explore", href: "/explore", labelKey: "nav.explore" },
  { id: "auctions", href: "/auctions", labelKey: "nav.auctions" },
  { id: "challenges", href: "/challenges", labelKey: "nav.challenges" },
] as const satisfies readonly { id: string; href: string; labelKey: MessageKey }[];

/** Home is current on `/` only; any other section on its own address and below it. */
export function isCurrent(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export type AccountLinkId = "dashboard" | "earnings" | "messages" | "wallet" | "mobile" | "settings";

/** The account menu's links; a creator also sees the earnings, with the balance. */
export function accountLinks(isCreator: boolean): { id: AccountLinkId; href: string; labelKey: MessageKey }[] {
  const link = (id: AccountLinkId, href: string, labelKey: MessageKey) => ({ id, href, labelKey });
  return [
    link("dashboard", "/me", "nav.dashboard"),
    ...(isCreator ? [link("earnings", "/me/earnings", "nav.earnings")] : []),
    link("messages", "/messages", "nav.messages"),
    link("wallet", "/wallet", "nav.wallet"),
    link("mobile", "/mobile", "nav.mobile"),
    link("settings", "/me/settings", "nav.settings"),
  ];
}
