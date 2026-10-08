"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Coins, LayoutDashboard, LogOut, MessageSquare, Search, Settings, Upload, Wallet } from "lucide-react";
import { AVATAR_PLACEHOLDER, useAuth } from "@/lib/auth-context";
import { OrochiaLogo } from "@/components/OrochiaLogo";
import { ThemeToggle } from "@/components/ThemeProvider";
import { NotificationBell } from "@/components/notifications/NotificationBell";
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
      className={`text-xs font-semibold uppercase tracking-wider transition-colors ${
        pathname.startsWith(href) ? "text-violet-400 light:text-violet-700" : "text-zinc-300 light:text-slate-700 hover:text-white hover:light:text-slate-950"
      }`}
    >
      {label}
    </Link>
  );
  const menuItem = (href: string, icon: React.ReactNode, label: string) => (
    <Link
      role="menuitem"
      href={href}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        (href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href.split("?")[0]) && href !== "/dashboard?tab=settings")
          ? "bg-violet-600/15 text-white light:text-violet-800"
          : "text-zinc-300 hover:bg-white/5 hover:text-white light:text-slate-700 hover:light:bg-black/4 hover:light:text-slate-950"
      }`}
    >
      <span className="text-zinc-400 light:text-slate-500">{icon}</span>
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 light:border-black/5 bg-zinc-950/80 light:bg-white/85 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Orochia">
          <OrochiaLogo size={30} />
          <span className="font-display text-base font-black tracking-wider text-white light:text-slate-900 sm:text-lg">
            OROCHIA<span className="text-violet-400">.</span>
          </span>
        </Link>

        <button
          onClick={onOpenSearch}
          className="hidden w-56 items-center gap-2 rounded-2xl border border-white/10 light:border-black/10 bg-zinc-900/60 light:bg-slate-100 px-3.5 py-2 text-xs text-zinc-400 light:text-slate-500 transition-colors hover:border-violet-500/50 md:flex lg:w-80"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 truncate text-left">{t("nav.searchPlaceholder")}</span>
          <kbd className="hidden rounded-sm border border-white/10 light:border-black/10 px-1.5 font-mono text-[10px] lg:inline">⌘K</kbd>
        </button>

        <nav className="hidden items-center gap-6 md:flex">
          {navLink("/explore", t("nav.explore"))}
          {user && navLink("/messages", t("nav.messages"))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSearch}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-300 light:text-slate-700 hover:bg-white/5 hover:light:bg-black/5 md:hidden"
            aria-label={t("nav.search")}
          >
            <Search className="h-5 w-5" />
          </button>
          <ThemeToggle />

          {user ? (
            <>
              <NotificationBell />
              {isCreator && (
                <Link
                  href="/creator/upload"
                  className="hidden items-center gap-1.5 rounded-full bg-linear-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-4 py-2 text-xs font-bold text-white shadow-xs shadow-violet-500/25 md:flex"
                >
                  <Upload className="h-3.5 w-3.5" /> {t("nav.upload")}
                </Link>
              )}
              <div className="relative hidden md:block" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 rounded-full border border-white/10 light:border-black/10 bg-zinc-900/90 light:bg-slate-100 py-1 pl-1 pr-3 hover:border-violet-500/40"
                >
                  <img src={user.avatarUrl || AVATAR_PLACEHOLDER} alt="" className="h-8 w-8 rounded-full object-cover" />
                  <span className="max-w-36 truncate text-xs font-bold text-white light:text-slate-900">{user.displayName}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                </button>
                {menuOpen && (
                  <div role="menu" className="kz-pop absolute right-0 mt-2 w-72 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-2xl light:border-black/10 light:bg-white/95 light:shadow-violet-900/10">
                    {/* Who you are — the whole card opens your public profile */}
                    <Link
                      role="menuitem"
                      href={`/@${user.username}`}
                      className="group flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-white/5 hover:light:bg-black/4"
                    >
                      <img src={user.avatarUrl || AVATAR_PLACEHOLDER} alt="" className="h-11 w-11 rounded-2xl object-cover ring-2 ring-violet-500/30" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-white light:text-slate-900">{user.displayName}</span>
                        <span className="block truncate text-[11px] text-zinc-400 group-hover:text-violet-300 light:text-slate-500 group-hover:light:text-violet-700">
                          @{user.username} · {t("nav.viewProfile")}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-zinc-500 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    {isCreator && (
                      <Link
                        role="menuitem"
                        href="/earnings"
                        className="mx-1 mb-1 mt-0.5 flex items-center justify-between rounded-xl bg-linear-to-r from-emerald-500/10 to-transparent px-3 py-2.5 ring-1 ring-emerald-500/20 transition-colors hover:from-emerald-500/20"
                      >
                        <span className="flex items-center gap-2 text-xs font-semibold text-zinc-200 light:text-slate-700">
                          <Wallet className="h-4 w-4 text-emerald-400" /> {t("nav.earnings")}
                        </span>
                        <span className="font-mono text-sm font-black text-emerald-400 light:text-emerald-600">${(user.balanceCents / 100).toFixed(2)}</span>
                      </Link>
                    )}
                    <div className="my-1 h-px bg-white/5 light:bg-black/5" />
                    {menuItem("/dashboard", <LayoutDashboard className="h-4 w-4" />, t("nav.dashboard"))}
                    {menuItem("/messages", <MessageSquare className="h-4 w-4" />, t("nav.messages"))}
                    {menuItem("/wallet", <Coins className="h-4 w-4" />, t("nav.wallet"))}
                    {menuItem("/dashboard?tab=settings", <Settings className="h-4 w-4" />, t("nav.settings"))}
                    <div className="my-1 h-px bg-white/5 light:bg-black/5" />
                    <button
                      role="menuitem"
                      onClick={() => void logout()}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300 light:text-slate-500 hover:light:text-rose-600"
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
                className="hidden lg:flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/5 hover:border-violet-500/40 hover:bg-violet-500/10 px-3.5 py-1.5 text-xs font-semibold text-violet-300 light:text-violet-700 transition-all"
                title={t("nav.uploadHint")}
              >
                <Upload className="h-3.5 w-3.5 text-violet-400" />
                <span>{t("nav.upload")}</span>
              </Link>
              {/* Desktop only: on a phone, signing in lives in the bottom tab bar (one entry per action). */}
              <div className="hidden items-center gap-1 rounded-full border border-white/10 light:border-black/10 bg-zinc-900/70 light:bg-slate-100 p-0.5 sm:p-1 shadow-xs md:flex">
                <Link
                  href="/auth/login"
                  className="rounded-full px-2.5 sm:px-4 py-1 sm:py-1.5 text-xs font-semibold text-zinc-200 light:text-slate-800 hover:text-white hover:light:text-slate-950 transition-colors"
                >
                  {t("nav.signIn")}
                </Link>
                <Link
                  href="/auth/register"
                  className="rounded-full bg-linear-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-3 sm:px-4 py-1 sm:py-1.5 text-xs font-bold text-white shadow-xs shadow-violet-500/25 transition-transform active:scale-95"
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
