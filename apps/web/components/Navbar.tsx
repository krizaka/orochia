"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LayoutDashboard, LogOut, Search, Settings, Upload, User, Wallet } from "lucide-react";
import { AVATAR_PLACEHOLDER, useAuth } from "@/lib/auth-context";
import { OrochiaLogo } from "@/components/OrochiaLogo";
import { ThemeToggle } from "@/components/ThemeProvider";
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
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  useEffect(() => setMenuOpen(false), [pathname]);

  const isCreator = user?.role === "CREATOR" || user?.role === "ADMIN";
  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`text-xs font-semibold uppercase tracking-wider transition-colors ${
        pathname.startsWith(href) ? "text-violet-400 light:text-violet-700" : "text-zinc-300 light:text-slate-700 hover:text-white light:hover:text-slate-950"
      }`}
    >
      {label}
    </Link>
  );
  const menuItem = (href: string, icon: React.ReactNode, label: string) => (
    <Link href={href} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-300 light:text-slate-700 hover:bg-violet-600/15 hover:text-white light:hover:text-slate-950">
      {icon}
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
          <kbd className="hidden rounded border border-white/10 light:border-black/10 px-1.5 font-mono text-[10px] lg:inline">⌘K</kbd>
        </button>

        <nav className="hidden items-center gap-6 md:flex">{navLink("/explore", t("nav.explore"))}</nav>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSearch}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-300 light:text-slate-700 hover:bg-white/5 light:hover:bg-black/5 md:hidden"
            aria-label={t("nav.search")}
          >
            <Search className="h-5 w-5" />
          </button>
          <ThemeToggle />

          {user ? (
            <>
              {isCreator && (
                <Link
                  href="/creator/upload"
                  className="hidden items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-violet-500/25 md:flex"
                >
                  <Upload className="h-3.5 w-3.5" /> {t("nav.upload")}
                </Link>
              )}
              <div className="relative hidden md:block" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-expanded={menuOpen}
                  className="flex items-center gap-2 rounded-full border border-white/10 light:border-black/10 bg-zinc-900/90 light:bg-slate-100 py-1 pl-1 pr-3 hover:border-violet-500/40"
                >
                  <img src={user.avatarUrl || AVATAR_PLACEHOLDER} alt="" className="h-8 w-8 rounded-full object-cover" />
                  <span className="max-w-[9rem] truncate text-xs font-bold text-white light:text-slate-900">{user.displayName}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-white/10 light:border-black/10 bg-zinc-950/95 light:bg-white p-2 shadow-2xl backdrop-blur-2xl">
                    <div className="mb-1 border-b border-white/5 light:border-black/5 p-3">
                      <p className="text-xs font-bold text-white light:text-slate-900">{user.displayName}</p>
                      <p className="text-[11px] text-zinc-400 light:text-slate-500">
                        @{user.username} · {t(`nav.roles.${user.role}`)}
                      </p>
                      <div className="mt-2 flex items-center justify-between rounded-xl bg-zinc-900/80 light:bg-slate-100 px-2.5 py-1.5 font-mono text-[11px]">
                        <span className="text-zinc-400 light:text-slate-500">{t("nav.balance")}</span>
                        <span className="font-bold text-emerald-400 light:text-emerald-700">${(user.balanceCents / 100).toFixed(2)}</span>
                      </div>
                    </div>
                    {menuItem("/dashboard", <LayoutDashboard className="h-4 w-4 text-violet-400" />, t("nav.dashboard"))}
                    {isCreator && menuItem(`/creators/${user.username}`, <User className="h-4 w-4 text-fuchsia-400" />, t("nav.profile"))}
                    {isCreator && menuItem("/creator/payouts", <Wallet className="h-4 w-4 text-emerald-400" />, t("nav.earnings"))}
                    {menuItem("/dashboard?tab=settings", <Settings className="h-4 w-4 text-zinc-400" />, t("nav.settings"))}
                    <button
                      onClick={() => void logout()}
                      className="mt-1 flex w-full items-center gap-2.5 rounded-xl border-t border-white/5 light:border-black/5 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/10"
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
                title="Creator Studio Upload"
              >
                <Upload className="h-3.5 w-3.5 text-violet-400" />
                <span>{t("nav.upload")}</span>
              </Link>
              {/* Desktop only: on a phone, signing in lives in the bottom tab bar (one entry per action). */}
              <div className="hidden items-center gap-1 rounded-full border border-white/10 light:border-black/10 bg-zinc-900/70 light:bg-slate-100 p-0.5 sm:p-1 shadow-sm md:flex">
                <Link
                  href="/auth/login"
                  className="rounded-full px-2.5 sm:px-4 py-1 sm:py-1.5 text-xs font-semibold text-zinc-200 light:text-slate-800 hover:text-white light:hover:text-slate-950 transition-colors"
                >
                  {t("nav.signIn")}
                </Link>
                <Link
                  href="/auth/register"
                  className="rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-3 sm:px-4 py-1 sm:py-1.5 text-xs font-bold text-white shadow-sm shadow-violet-500/25 transition-transform active:scale-95"
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
