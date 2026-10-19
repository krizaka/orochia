"use client";

import { OrochiaLogo } from "@krizaka/orochia-design-system";
import { cn } from "@krizaka/ui/cn";
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
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

import { NAV_SECTIONS, type NavIcon } from "@/console/lib/nav";

const ICONS: Record<NavIcon, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
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

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border-default bg-surface-1 flex flex-col justify-between shrink-0 min-h-screen">
      <div>
        {/* Brand */}
        <div className="h-16 flex items-center px-6 border-b border-border-default gap-2.5">
          <OrochiaLogo size={40} />
          <div>
            <span className="text-sm font-black tracking-wider text-fg font-display">
              OROCHIA<span className="text-fg-accent">.</span>
            </span>
            <span className="block text-[10px] font-mono text-fg-secondary uppercase tracking-widest leading-none">
              Control Plane
            </span>
          </div>
        </div>

        {/* The operator's jobs, in sections (lib/nav.ts) */}
        <nav aria-label="Console" className="p-3 space-y-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.id}>
              {section.id !== "overview" && (
                <p id={`nav-${section.id}`} className="px-3.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-widest text-fg-secondary">
                  {section.label}
                </p>
              )}
              <ul aria-labelledby={section.id !== "overview" ? `nav-${section.id}` : undefined} className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = ICONS[item.icon];
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all",
                          isActive ? "bg-accent text-on-accent shadow-glow-primary" : "text-fg-secondary hover:bg-surface-2 hover:text-fg",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border-subtle space-y-3">
        <a
          href={process.env.NEXT_PUBLIC_OPERATOR_PLATFORM_URL || "http://localhost:3000"}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-fg-secondary hover:text-fg hover:bg-surface-2 transition-colors"
        >
          <span>Open Consumer App</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </aside>
  );
}
