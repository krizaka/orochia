"use client";

import {
  ChevronDownIcon as ChevronDown,
  ChevronRightIcon as ChevronRight,
  CreatorIcon as LayoutDashboard,
  CreditsIcon as Coins,
  LogoutIcon as LogOut,
  MessageIcon as MessageSquare,
  SearchIcon as Search,
  SettingsIcon as Settings,
  UploadIcon as Upload,
  WalletIcon as Wallet,
} from "@krizaka/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Avatar, cn,IconButton, OrochiaLogo, ThemeToggle } from "@/components/ui";
import { AVATAR_PLACEHOLDER, useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";

/**
 * The top bar. Desktop: brand, search, Explore, Upload and the account (or Sign in / Join).
 * Mobile: brand, search and theme only — navigation and the account live in the bottom tab bar
 * (MobileBottomNav), so each action exists once on a phone.
 */
export function Navbar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => menuRef.current && !menuRef.current.contains(e.target as Node) && setMenuOpen(false);
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  useEffect(() => setMenuOpen(false), [pathname]);

  const isCreator = user?.role === "CREATOR" || user?.role === "ADMIN";
  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={cn(
        "text-xs font-semibold uppercase tracking-wider transition-colors",
        pathname.startsWith(href) ? "text-fg-accent" : "text-fg-secondary hover:text-fg"
      )}
    >
      {label}
    </Link>
  );
  const menuItem = (href: string, icon: React.ReactNode, label: string) => (
    <Link
      role="menuitem"
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        (href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href.split("?")[0]) && href !== "/dashboard?tab=settings")
          ? "bg-accent/15 text-fg"
          : "text-fg-secondary hover:bg-surface-2 hover:text-fg"
      )}
    >
      <span className="text-fg-secondary">{icon}</span>
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border-default bg-surface-1/80 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Orochia">
          <OrochiaLogo size={30} />
          <span className="font-display text-base font-black tracking-wider text-fg sm:text-lg">
            OROCHIA<span className="text-fg-accent">.</span>
          </span>
        </Link>

        <button
          onClick={onOpenSearch}
          className="hidden w-56 items-center gap-2 rounded-2xl border border-border-default bg-surface-2/60 px-3.5 py-2 text-xs text-fg-secondary transition-colors hover:border-accent/50 md:flex lg:w-80"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 truncate text-left">{t("nav.searchPlaceholder")}</span>
          <kbd className="hidden rounded-sm border border-border-default px-1.5 font-mono text-[10px] lg:inline">⌘K</kbd>
        </button>

        <nav className="hidden items-center gap-6 md:flex">
          {navLink("/explore", t("nav.explore"))}
          {navLink("/auctions", t("nav.auctions"))}
          {navLink("/challenges", t("nav.challenges"))}
          {user && navLink("/messages", t("nav.messages"))}
        </nav>

        <div className="flex items-center gap-2">
          <IconButton onClick={onOpenSearch} shape="rounded" className="h-9 w-9 rounded-xl md:hidden" label={t("nav.search")}>
            <Search className="h-5 w-5" aria-hidden />
          </IconButton>
          <ThemeToggle />

          {user ? (
            <>
              <NotificationBell />
              {isCreator && (
                <Link
                  href="/creator/upload"
                  className="hidden items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-bold text-on-accent shadow-xs transition-colors hover:bg-accent-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring md:flex"
                >
                  <Upload className="h-3.5 w-3.5" /> {t("nav.upload")}
                </Link>
              )}
              <div className="relative hidden md:block" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 rounded-full border border-border-default bg-surface-2/90 py-1 pl-1 pr-3 hover:border-accent/40"
                >
                  <Avatar size="sm" src={user.avatarUrl || AVATAR_PLACEHOLDER} fallback={user.displayName.charAt(0)} />
                  <span className="max-w-36 truncate text-xs font-bold text-fg">{user.displayName}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-fg-secondary" />
                </button>
                {menuOpen && (
                  <div role="menu" className="kz-pop absolute right-0 mt-2 w-72 overflow-hidden rounded-2xl border border-border-default bg-surface-1/95 p-1.5 shadow-lg backdrop-blur-2xl">
                    {/* Who you are — the whole card opens your public profile */}
                    <Link
                      role="menuitem"
                      href={`/@${user.username}`}
                      className="group flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-surface-2"
                    >
                      <Avatar src={user.avatarUrl || AVATAR_PLACEHOLDER} fallback={user.displayName.charAt(0)} className="h-11 w-11 rounded-2xl ring-2 ring-accent/30" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-fg">{user.displayName}</span>
                        <span className="block truncate text-[11px] text-fg-secondary group-hover:text-fg-accent">
                          @{user.username} · {t("nav.viewProfile")}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-fg-muted transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    {isCreator && (
                      <Link
                        role="menuitem"
                        href="/earnings"
                        className="mx-1 mb-1 mt-0.5 flex items-center justify-between rounded-xl bg-linear-to-r from-success/10 to-transparent px-3 py-2.5 ring-1 ring-success/20 transition-colors hover:from-success/20"
                      >
                        <span className="flex items-center gap-2 text-xs font-semibold text-fg">
                          <Wallet className="h-4 w-4 text-success" /> {t("nav.earnings")}
                        </span>
                        <span className="font-mono text-sm font-black text-success">${(user.balanceCents / 100).toFixed(2)}</span>
                      </Link>
                    )}
                    <div className="my-1 h-px bg-surface-2" />
                    {menuItem("/dashboard", <LayoutDashboard className="h-4 w-4" />, t("nav.dashboard"))}
                    {menuItem("/messages", <MessageSquare className="h-4 w-4" />, t("nav.messages"))}
                    {menuItem("/wallet", <Coins className="h-4 w-4" />, t("nav.wallet"))}
                    {menuItem("/dashboard?tab=settings", <Settings className="h-4 w-4" />, t("nav.settings"))}
                    <div className="my-1 h-px bg-surface-2" />
                    <button
                      role="menuitem"
                      onClick={() => void logout()}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-fg-secondary transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      <LogOut className="h-4 w-4" /> {t("nav.signOut")}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/creator/upload"
                className="hidden lg:flex items-center gap-1.5 rounded-full border border-border-default bg-accent-soft px-3.5 py-1.5 text-xs font-semibold text-fg-accent transition-colors hover:border-border-strong focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                title={t("nav.uploadHint")}
              >
                <Upload className="h-3.5 w-3.5" />
                <span>{t("nav.upload")}</span>
              </Link>
              {/* Desktop only: on a phone, signing in lives in the bottom tab bar (one entry per action). */}
              <div className="hidden items-center gap-1 rounded-full border border-border-default bg-surface-2/70 p-0.5 sm:p-1 shadow-xs md:flex">
                <Link
                  href="/auth/login"
                  className="whitespace-nowrap rounded-full px-2.5 sm:px-4 py-1 sm:py-1.5 text-xs font-semibold text-fg hover:text-fg-accent transition-colors"
                >
                  {t("nav.signIn")}
                </Link>
                <Link
                  href="/auth/register"
                  className="whitespace-nowrap rounded-full bg-accent px-3 sm:px-4 py-1 sm:py-1.5 text-xs font-bold text-on-accent shadow-xs transition-colors hover:bg-accent-hover active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("nav.join")}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
