"use client";

import { OrochiaLogo } from "@krizaka/orochia-design-system";
import { AppShell } from "@krizaka/ui/app-shell";
import { IconButton } from "@krizaka/ui/button";
import { ThemeToggle } from "@krizaka/ui/theme";
import {
  Activity,
  AlertTriangle,
  Database,
  ExternalLink,
  Gauge,
  Gavel,
  HardDrive,
  History,
  LayoutDashboard,
  ListChecks,
  LogOut,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React from "react";

import { BuildBadge } from "@/console/components/BuildBadge";
import type { AdminIdentity } from "@/console/lib/account";
import { NAV_SECTIONS, type NavIcon } from "@/console/lib/nav";

const ICONS: Record<NavIcon, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  tasks: ListChecks,
  compliance: ShieldCheck,
  moderation: AlertTriangle,
  treasury: Wallet,
  catalogue: Activity,
  auctions: Gavel,
  creators: Users,
  users: UserCog,
  storage: HardDrive,
  explorer: Sparkles,
  operations: Gauge,
  "app-versions": Smartphone,
  audit: History,
  platform: Database,
};

/** The console has no i18n: English labels, fixed (one operator). */
const THEME_LABEL = { dark: "Theme: dark — switch to light", light: "Theme: light — follow the system", system: "Theme: system — switch to dark" };

/** The current screen: the overview on `/` only, any other section on its address and below it. */
const isCurrent = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

/**
 * The signed-in console in the Krizaka UI shell (`@krizaka/ui/app-shell`): the operator's jobs as groups of the sidebar
 * (lib/nav.ts), a drawer on a phone, the DEV badge, the theme and the sign-out in the header. A private console: no
 * family switcher, no family footer.
 */
export function ConsoleShell({ admin, children }: { admin: AdminIdentity; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const signOut = async () => {
    await fetch("/api/session", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  };
  return (
    <AppShell.Root skipLabel="Skip to content">
      <AppShell.Sidebar
        label="Console"
        closeLabel="Close the menu"
        collapseLabels={["Collapse", "Expand"]}
        brand={
          <>
            <OrochiaLogo size={28} />
            <span>
              Orochia <span className="font-mono text-xs font-normal text-fg-secondary">Control Plane</span>
            </span>
          </>
        }
        footer={
          <div className="flex flex-col gap-1">
            <p className="truncate px-3 pt-1 text-xs text-fg-secondary" title={admin.email}>
              {admin.displayName}
            </p>
            <a
              href={process.env.NEXT_PUBLIC_OPERATOR_PLATFORM_URL || "http://localhost:3000"}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium text-fg-secondary hover:bg-surface-2 hover:text-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              <span>Open Consumer App</span>
            </a>
          </div>
        }
      >
        {NAV_SECTIONS.map((section) => (
          <React.Fragment key={section.id}>
            {section.id !== "overview" && <AppShell.Group>{section.label}</AppShell.Group>}
            {section.items.map((item) => {
              const Icon = ICONS[item.icon];
              return (
                <AppShell.Item key={item.href} asChild icon={<Icon />} label={item.label} current={isCurrent(pathname, item.href)}>
                  <Link href={item.href} />
                </AppShell.Item>
              );
            })}
          </React.Fragment>
        ))}
      </AppShell.Sidebar>
      <AppShell.Body>
        <AppShell.Header
          menuLabel="Open the menu"
          actions={
            <>
              <BuildBadge />
              <ThemeToggle label={(mode) => THEME_LABEL[mode]} variant="secondary" className="h-9 w-9" />
              <IconButton label="Sign out" variant="secondary" onClick={signOut} className="h-9 w-9">
                <LogOut className="h-4 w-4" />
              </IconButton>
            </>
          }
        />
        <AppShell.Main>{children}</AppShell.Main>
      </AppShell.Body>
    </AppShell.Root>
  );
}
