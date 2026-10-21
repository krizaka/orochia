"use client";

import { BarChart3, Clapperboard, CreditCard, Film, Layers, LayoutDashboard, ListChecks, Settings, Shield, Sparkles, Upload, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "@/lib/use-pathname";
import React from "react";

import { Avatar, Badge, buttonVariants, cn, Select } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-client";
import { activeMeItem, meGroupsFor,type MeItem } from "@/lib/me-nav";
import { defaultAvatarFor } from "@/lib/presets";

import { MeDataProvider, useMeData } from "./MeData";

const ICONS: Record<MeItem["icon"], React.ComponentType<{ className?: string }>> = {
  home: LayoutDashboard,
  film: Clapperboard,
  library: Film,
  layers: Layers,
  list: ListChecks,
  users: Users,
  sparkles: Sparkles,
  wallet: Wallet,
  card: CreditCard,
  chart: BarChart3,
  settings: Settings,
  shield: Shield,
};

function Counter({ id }: { id: string }) {
  const { data } = useMeData();
  const n = id === "videos" ? data?.uploads.length : id === "library" ? data?.library.length : undefined;
  return n ? <span className="ml-auto font-mono text-[11px] text-fg-muted">{n}</span> : null;
}

/**
 * The private space: a slim header (who you are, the balance, the two things you do most), then the sections.
 * On a computer the sections are a sidebar, grouped; on a phone one « Go to » select — never a strip of tabs.
 * The balance stays in the header whatever the section.
 */
export function MeShell({ children }: { children: React.ReactNode }) {
  const { t, money } = useI18n();
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h2 className="font-display text-2xl font-bold text-fg">{t("dashboard.signedOut.title")}</h2>
        <p className="mt-2 text-sm text-fg-secondary">{t("dashboard.signedOut.body")}</p>
        <Link href={`/auth/login?next=${encodeURIComponent(pathname)}`} className={cn(buttonVariants({ variant: "primary", shape: "pill" }), "mt-6")}>
          {t("dashboard.signedOut.cta")}
        </Link>
      </div>
    );
  }

  const isCreator = user.role === "CREATOR";
  const groups = meGroupsFor(user.role);
  const active = activeMeItem(pathname);

  return (
    <MeDataProvider>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border-subtle pb-5">
          <Avatar
            src={user.avatarUrl}
            defaultAvatar={{ brand: "orochia", seed: user.displayName }}
            fallbackSrc={defaultAvatarFor(user.displayName)}
            fallback={user.displayName.charAt(0)}
            className="h-14 w-14 rounded-2xl"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-xl font-black tracking-tight text-fg sm:text-2xl">{user.displayName}</h1>
            <p className="font-mono text-xs text-fg-secondary">
              @{user.username}
              {isCreator && <Badge size="sm" tone="accent" className="ml-2 font-sans font-bold">{t("profile.creator")}</Badge>}
            </p>
          </div>
          {isCreator && (
            <Link href="/me/earnings" className="text-right" aria-label={t("profile.balance")}>
              <span className="block text-[10px] font-semibold text-fg-secondary">{t("profile.balance")}</span>
              <span className="font-mono text-lg font-black text-fg-success">{money(user.balanceCents)}</span>
            </Link>
          )}
          <div className="flex items-center gap-2">
            <Link href={`/@${user.username}`} className={buttonVariants({ variant: "ghost", size: "sm", shape: "pill" })}>
              {t("profile.viewPublic")}
            </Link>
            {isCreator && user.isVerified !== false && (
              <Link href="/creator/upload" className={buttonVariants({ variant: "primary", size: "sm", shape: "pill" })}>
                <Upload className="h-4 w-4" aria-hidden /> {t("profile.upload")}
              </Link>
            )}
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
          {/* Phone: one select with the sections grouped. */}
          <div className="lg:hidden">
            <label className="sr-only" htmlFor="me-section">{t("dashboard.me.sectionLabel")}</label>
            <Select id="me-section" value={active?.href ?? "/me"} onChange={(e) => router.push(e.target.value)} className="rounded-xl">
              {groups.map((g) => (
                <optgroup key={g.id} label={t(g.label)}>
                  {g.items.map((i) => (
                    <option key={i.id} value={i.href}>{t(i.label)}</option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>

          {/* Computer: a sidebar. */}
          <nav aria-label={t("dashboard.me.menuLabel")} className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              {groups.map((g) => (
                <div key={g.id}>
                  <h2 className="px-3 pb-1 text-[10px] font-bold text-fg-muted">{t(g.label)}</h2>
                  <ul className="space-y-0.5">
                    {g.items.map((i) => {
                      const Icon = ICONS[i.icon];
                      const current = active?.id === i.id;
                      return (
                        <li key={i.id}>
                          <Link
                            href={i.href}
                            aria-current={current ? "page" : undefined}
                            className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors", current ? "bg-accent/12 text-fg" : "text-fg-secondary hover:bg-surface-2 hover:text-fg")}
                          >
                            <Icon className={cn("h-4 w-4 shrink-0", current ? "text-fg-accent" : "text-fg-muted")} />
                            <span>{t(i.label)}</span>
                            <Counter id={i.id} />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </nav>

          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </MeDataProvider>
  );
}
