/**
 * The console's navigation, by the operator's jobs (docs/UX_DECISIONS.md): five sections, each screen once. The sidebar
 * draws it; `lib/nav.test.ts` keeps its shape (at most five sections, every screen listed, no orphan).
 */
export type NavIcon =
  | "overview"
  | "tasks"
  | "compliance"
  | "moderation"
  | "treasury"
  | "catalogue"
  | "auctions"
  | "creators"
  | "users"
  | "storage"
  | "explorer"
  | "operations"
  | "app-versions"
  | "audit"
  | "platform";

export interface NavItem {
  label: string;
  href: string;
  icon: NavIcon;
}

export interface NavSection {
  id: "overview" | "people" | "content" | "money" | "platform";
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  { id: "overview", label: "Overview", items: [
      { label: "Overview", href: "/", icon: "overview" },
      { label: "Tasks", href: "/tasks", icon: "tasks" },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      { label: "2257 Creator Verification", href: "/compliance", icon: "compliance" },
      { label: "Creator Registry", href: "/creators", icon: "creators" },
      { label: "Accounts", href: "/users", icon: "users" },
    ],
  },
  {
    id: "content",
    label: "Content",
    items: [
      { label: "Content Reports", href: "/moderation", icon: "moderation" },
      { label: "Catalogue", href: "/catalogue", icon: "catalogue" },
    ],
  },
  {
    id: "money",
    label: "Money",
    items: [
      { label: "Treasury & Payouts", href: "/treasury", icon: "treasury" },
      { label: "Auctions", href: "/auctions", icon: "auctions" },
    ],
  },
  {
    id: "platform",
    label: "Platform",
    items: [
      { label: "Operations", href: "/operations", icon: "operations" },
      { label: "Storage & Abuse", href: "/storage", icon: "storage" },
      { label: "Explorer on Orazaka", href: "/explorer", icon: "explorer" },
      { label: "App versions", href: "/app-versions", icon: "app-versions" },
      { label: "Platform & Database", href: "/platform", icon: "platform" },
      { label: "Audit log", href: "/audit", icon: "audit" },
    ],
  },
];

export const navItems = (): NavItem[] => NAV_SECTIONS.flatMap((s) => s.items);
