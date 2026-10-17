import type { MessageKey } from "./i18n";
import routes from "./me-routes.json";

/**
 * The private dashboard's navigation: the eleven former tabs, grouped by what the person is doing. Each view is
 * its own address under /me (shareable, reloadable, back-button safe, claimed by the app's universal links).
 *
 * Why these four groups (the reasoning is in the PR): Content is what I make and keep (jobs: publish, organise),
 * Audience is who sees it (people, invitations, what works), Money is what I earn and spend (one place for the
 * balance, its movements and the payouts), Account is the rest (settings). A fan has no videos, earnings or
 * insights, so for them the groups shrink to Library, Collections, Lists, Network, Transactions, Settings.
 */
export type MeRole = "MEMBER" | "CREATOR" | "ADMIN";

export interface MeItem {
  id: string;
  href: string;
  /** Message key (`dashboard.nav.<id>`); a count may be appended by the view. */
  label: MessageKey;
  icon: "home" | "film" | "library" | "layers" | "list" | "users" | "sparkles" | "wallet" | "card" | "chart" | "settings" | "shield";
  roles?: MeRole[];
}

export interface MeGroup {
  id: "content" | "audience" | "money" | "account";
  label: MessageKey;
  items: MeItem[];
}

const CREATOR: MeRole[] = ["CREATOR", "ADMIN"];

export const ME_GROUPS: MeGroup[] = [
  {
    id: "content",
    label: "dashboard.group.content",
    items: [
      { id: "overview", href: "/me", label: "dashboard.nav.overview", icon: "home" },
      { id: "videos", href: "/me/videos", label: "dashboard.nav.videos", icon: "film", roles: CREATOR },
      { id: "collections", href: "/me/collections", label: "dashboard.nav.collections", icon: "layers" },
      { id: "library", href: "/me/library", label: "dashboard.nav.library", icon: "library" },
      { id: "lists", href: "/me/lists", label: "dashboard.nav.lists", icon: "list" },
    ],
  },
  {
    id: "audience",
    label: "dashboard.group.audience",
    items: [
      { id: "network", href: "/me/network", label: "dashboard.nav.network", icon: "users" },
      { id: "invitations", href: "/me/invitations", label: "dashboard.nav.invitations", icon: "sparkles" },
      { id: "insights", href: "/me/insights", label: "dashboard.nav.insights", icon: "chart", roles: CREATOR },
    ],
  },
  {
    id: "money",
    label: "dashboard.group.money",
    items: [
      { id: "transactions", href: "/me/transactions", label: "dashboard.nav.transactions", icon: "wallet" },
      { id: "earnings", href: "/me/earnings", label: "dashboard.nav.earnings", icon: "card", roles: CREATOR },
      { id: "treasury", href: "/me/treasury", label: "dashboard.nav.treasury", icon: "shield", roles: ["ADMIN"] },
    ],
  },
  {
    id: "account",
    label: "dashboard.group.account",
    items: [{ id: "settings", href: "/me/settings", label: "dashboard.nav.settings", icon: "settings" }],
  },
];

/** The groups a role sees; a group with no item left disappears. */
export function meGroupsFor(role: MeRole): MeGroup[] {
  return ME_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || i.roles.includes(role)) })).filter((g) => g.items.length > 0);
}

/** The item the address belongs to (`/me/videos/…` is still « My videos »). */
export function activeMeItem(pathname: string): MeItem | undefined {
  const path = pathname.replace(/\/+$/, "") || "/";
  const items = ME_GROUPS.flatMap((g) => g.items);
  return items.filter((i) => i.href !== "/me").find((i) => path === i.href || path.startsWith(`${i.href}/`)) ?? items.find((i) => i.href === path);
}

/** Where an old `/dashboard?tab=…` address now lives. */
export function legacyMeHref(tab: string | null | undefined): string {
  return (routes.tabs as Record<string, string>)[tab ?? ""] ?? "/me";
}
