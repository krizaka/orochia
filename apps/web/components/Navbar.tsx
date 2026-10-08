"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  Flame,
  Upload,
  Wallet,
  LayoutDashboard,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Sparkles,
  Search,
  LogIn,
  UserPlus,
  Menu,
  X,
  Compass
} from "lucide-react";
import { OrochiaLogo } from "@/components/OrochiaLogo";
import { ThemeToggle } from "@/components/ThemeProvider";
import { GlobalSearchModal } from "@/components/GlobalSearchModal";

export function Navbar() {
  const { user, logout, switchProfile, demoMode } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 w-full max-w-full overflow-hidden border-b border-white/10 dark:border-white/10 light:border-black/5 bg-zinc-950/80 dark:bg-zinc-950/80 light:bg-white/85 backdrop-blur-xl transition-colors duration-200">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-6 gap-2 sm:gap-3">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <OrochiaLogo size={32} />
            <span className="text-base sm:text-lg font-black tracking-wider text-white dark:text-white light:text-slate-900 font-display">
              OROCHIA<span className="text-violet-400">.</span>
            </span>
          </Link>

          {/* Global Quick Search Bar Trigger (Desktop) */}
          <button
            onClick={() => setSearchModalOpen(true)}
            type="button"
            className="hidden md:flex items-center gap-2 rounded-2xl border border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-900/60 dark:bg-zinc-900/60 light:bg-slate-100 px-3.5 py-1.5 text-xs text-zinc-400 dark:text-zinc-400 light:text-slate-500 hover:border-violet-500/50 hover:text-white dark:hover:text-white light:hover:text-black transition-all w-48 lg:w-72 cursor-pointer group shadow-inner"
          >
            <Search className="h-3.5 w-3.5 text-violet-400 group-hover:scale-110 transition-transform" />
            <span className="flex-1 text-left truncate">Search creators, 4K…</span>
            <kbd className="hidden lg:inline-block rounded border border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-800/80 dark:bg-zinc-800/80 light:bg-white px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 shadow-sm">
              ⌘K
            </kbd>
          </button>

          {/* Navigation links */}
          <nav className="hidden md:flex items-center gap-5 shrink-0">
            <Link
              href="/explore"
              className="text-xs font-semibold uppercase tracking-wider text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:text-white dark:hover:text-white light:hover:text-black transition-colors"
            >
              Explore
            </Link>
            {user && (
              <Link
                href="/dashboard"
                className="text-xs font-semibold uppercase tracking-wider text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-violet-400" />
                <span>Mon Espace</span>
              </Link>
            )}
            {user?.role === "CREATOR" && (
              <Link
                href="/creator/payouts"
                className="text-xs font-semibold uppercase tracking-wider text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <Wallet className="h-3.5 w-3.5 text-emerald-400" />
                <span>Earnings</span>
              </Link>
            )}
          </nav>

          {/* Action buttons, Theme Switcher & User Menu */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Dark / Light Theme Toggle Button */}
            <ThemeToggle className="h-8 w-8 sm:h-9 sm:w-9" />

            {/* Creator Upload Shortcut (desktop / tablet) */}
            <Link
              href="/creator/upload"
              className="hidden sm:flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-violet-600/30 transition-all hover:scale-105 active:scale-95"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload</span>
            </Link>

            {/* User Profile or Guest Auth */}
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-1.5 sm:gap-2.5 rounded-2xl border border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-900/90 dark:bg-zinc-900/90 light:bg-slate-100 py-1 pl-1.5 pr-2 sm:py-1.5 sm:pl-2 sm:pr-3 text-left transition-all hover:border-violet-500/40"
                >
                  <div className="relative h-8 w-8 overflow-hidden rounded-xl border border-violet-500/40 bg-zinc-800">
                    <img
                      src={user.avatarUrl}
                      alt={user.displayName}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-zinc-950" />
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs font-bold text-white dark:text-white light:text-slate-900 leading-none truncate max-w-[100px]">
                      {user.displayName}
                    </p>
                    <p className="text-[10px] font-mono text-violet-400 mt-0.5">
                      {user.role === "CREATOR" ? "Creator" : "Patron"}
                    </p>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                </button>

                {/* Rich Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl border border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-950/95 dark:bg-zinc-950/95 light:bg-white p-2 shadow-2xl backdrop-blur-2xl z-50">
                    {/* User summary in dropdown */}
                    <div className="border-b border-white/5 dark:border-white/5 light:border-black/5 p-3 mb-1">
                      <p className="text-xs font-bold text-white dark:text-white light:text-slate-900">{user.displayName}</p>
                      <p className="text-[11px] text-zinc-400">@{user.username}</p>
                      <div className="mt-2 flex items-center justify-between rounded-xl bg-zinc-900/80 dark:bg-zinc-900/80 light:bg-slate-100 px-2.5 py-1.5 text-[11px] font-mono">
                        <span className="text-zinc-400">
                          {user.role === "CREATOR" ? "Earnings" : "Balance"}
                        </span>
                        <span className="font-bold text-emerald-400">
                          ${(user.balanceCents / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Links */}
                    <div className="space-y-0.5">
                      <Link
                        href="/dashboard"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:bg-violet-600/20 hover:text-white dark:hover:text-white light:hover:text-black transition-colors"
                      >
                        <LayoutDashboard className="h-4 w-4 text-violet-400" />
                        <span>Mon Espace (Dashboard)</span>
                      </Link>

                      <Link
                        href="/profile"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:bg-violet-600/20 hover:text-white transition-colors"
                      >
                        <User className="h-4 w-4 text-fuchsia-400" />
                        <span>My Public Profile</span>
                      </Link>

                      {user.role === "CREATOR" && (
                        <Link
                          href="/creator/payouts"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:bg-violet-600/20 hover:text-white transition-colors"
                        >
                          <Wallet className="h-4 w-4 text-emerald-400" />
                          <span>Payouts & Tips Ledger</span>
                        </Link>
                      )}

                      <Link
                        href="/dashboard?tab=settings"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:bg-white/5 transition-colors"
                      >
                        <Settings className="h-4 w-4 text-zinc-400" />
                        <span>Account Settings</span>
                      </Link>
                    </div>

                    {/* Switch Demo Role (For easy client evaluation) */}
                    {demoMode && (
                      <div className="border-t border-white/5 dark:border-white/5 light:border-black/5 pt-2 mt-2">
                        <p className="px-3 text-[10px] uppercase font-semibold text-zinc-500 mb-1">
                          Quick Demo Switcher
                        </p>
                        <div className="grid grid-cols-2 gap-1 px-1">
                          <button
                            onClick={() => {
                              switchProfile("creator");
                              setDropdownOpen(false);
                            }}
                            className={`rounded-lg py-1 px-2 text-[10px] font-semibold transition-colors ${
                              user.role === "CREATOR"
                                ? "bg-violet-600/30 text-violet-300 border border-violet-500/40"
                                : "bg-zinc-900 dark:bg-zinc-900 light:bg-slate-100 text-zinc-400 hover:text-white"
                            }`}
                          >
                            Creator Mode
                          </button>
                          <button
                            onClick={() => {
                              switchProfile("patron");
                              setDropdownOpen(false);
                            }}
                            className={`rounded-lg py-1 px-2 text-[10px] font-semibold transition-colors ${
                              user.role === "MEMBER"
                                ? "bg-fuchsia-600/30 text-fuchsia-300 border border-fuchsia-500/40"
                                : "bg-zinc-900 dark:bg-zinc-900 light:bg-slate-100 text-zinc-400 hover:text-white"
                            }`}
                          >
                            Patron Mode
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Logout */}
                    <div className="border-t border-white/5 dark:border-white/5 light:border-black/5 pt-1 mt-2">
                      <button
                        onClick={() => {
                          logout();
                          setDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Disconnect Session</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Link
                  href="/auth/login"
                  className="flex items-center gap-1 rounded-xl border border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-900 dark:bg-zinc-900 light:bg-slate-100 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-semibold text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:bg-zinc-800 hover:text-white transition-all"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">Log In</span>
                </Link>
                <Link
                  href="/auth/register"
                  className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs font-bold text-white shadow-md shadow-violet-600/25 hover:from-violet-500 hover:to-fuchsia-500 transition-all"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Register</span>
                </Link>
              </div>
            )}

            {/* Mobile menu hamburger toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-900 dark:bg-zinc-900 light:bg-slate-100 text-zinc-300 hover:text-white"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile slide-down navigation menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-white/10 dark:border-white/10 light:border-black/5 bg-zinc-950/95 dark:bg-zinc-950/95 light:bg-white px-4 py-4 backdrop-blur-2xl">
            {user ? (
              <div className="mb-4 rounded-2xl border border-white/10 dark:border-white/10 light:border-black/5 bg-zinc-900/60 dark:bg-zinc-900/60 light:bg-slate-50 p-3">
                <div className="flex items-center gap-3">
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    className="h-10 w-10 rounded-xl object-cover border border-violet-500/40"
                  />
                  <div>
                    <p className="text-sm font-bold text-white dark:text-white light:text-slate-900 leading-tight">{user.displayName}</p>
                    <p className="text-xs text-zinc-400">@{user.username}</p>
                    <span className="text-[10px] font-mono text-violet-400">
                      {user.role === "CREATOR" ? "Creator" : "Patron"} · ${(user.balanceCents / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-4 grid grid-cols-2 gap-2">
                <Link
                  href="/auth/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-900 dark:bg-zinc-900 light:bg-slate-100 py-2.5 text-xs font-semibold text-zinc-200 dark:text-zinc-200 light:text-slate-800"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Log In</span>
                </Link>
                <Link
                  href="/auth/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-600/30"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Register</span>
                </Link>
              </div>
            )}

            <div className="space-y-1">
              <Link
                href="/explore"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:bg-white/5"
              >
                <Compass className="h-4 w-4 text-violet-400" />
                <span>Explore Streams</span>
              </Link>
              {user && (
                <>
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:bg-white/5"
                  >
                    <LayoutDashboard className="h-4 w-4 text-violet-400" />
                    <span>Mon Espace (Dashboard)</span>
                  </Link>
                  <Link
                    href="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:bg-white/5"
                  >
                    <User className="h-4 w-4 text-fuchsia-400" />
                    <span>Mon Profil Public</span>
                  </Link>
                  {user.role === "CREATOR" && (
                    <Link
                      href="/creator/payouts"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:bg-white/5"
                    >
                      <Wallet className="h-4 w-4 text-emerald-400" />
                      <span>Earnings & Ledger</span>
                    </Link>
                  )}
                  <Link
                    href="/dashboard?tab=settings"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:bg-white/5"
                  >
                    <Settings className="h-4 w-4 text-zinc-400" />
                    <span>Account Settings</span>
                  </Link>
                </>
              )}
            </div>

            {/* Quick Demo Switcher on mobile */}
            {demoMode && (
              <div className="mt-4 border-t border-white/5 dark:border-white/5 light:border-black/5 pt-3">
                <p className="text-[10px] uppercase font-semibold text-zinc-500 mb-2">
                  Quick Demo Role Switcher
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      switchProfile("creator");
                      setMobileMenuOpen(false);
                    }}
                    className={`rounded-xl py-2 px-3 text-xs font-semibold transition-colors ${
                      user?.role === "CREATOR"
                        ? "bg-violet-600/30 text-violet-300 border border-violet-500/40"
                        : "bg-zinc-900 dark:bg-zinc-900 light:bg-slate-100 text-zinc-400"
                    }`}
                  >
                    Creator Mode
                  </button>
                  <button
                    onClick={() => {
                      switchProfile("patron");
                      setMobileMenuOpen(false);
                    }}
                    className={`rounded-xl py-2 px-3 text-xs font-semibold transition-colors ${
                      user?.role === "MEMBER"
                        ? "bg-fuchsia-600/30 text-fuchsia-300 border border-fuchsia-500/40"
                        : "bg-zinc-900 dark:bg-zinc-900 light:bg-slate-100 text-zinc-400"
                    }`}
                  >
                    Patron Mode
                  </button>
                </div>
              </div>
            )}

            {user && (
              <div className="mt-3 border-t border-white/5 dark:border-white/5 light:border-black/5 pt-2">
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/10"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Disconnect Session</span>
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Global Search Dialog */}
      <GlobalSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
      />
    </>
  );
}
