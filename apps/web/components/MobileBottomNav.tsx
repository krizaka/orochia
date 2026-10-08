"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Search, Plus, BookOpen, User, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function MobileBottomNav({
  onOpenSearch,
}: {
  onOpenSearch: () => void;
}) {
  const pathname = usePathname();
  const { user } = useAuth();

  const isHome = pathname === "/";
  const isCodex = pathname === "/codex";
  const isDashboard = pathname.startsWith("/dashboard") || pathname.startsWith("/profile");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-950/90 dark:bg-zinc-950/90 light:bg-white/95 backdrop-blur-2xl pb-safe">
      <div className="flex h-16 items-center justify-around px-2">
        {/* Home */}
        <Link
          href="/"
          className={`flex flex-col items-center justify-center gap-1 w-14 transition-colors ${
            isHome
              ? "text-violet-400 font-bold"
              : "text-zinc-400 dark:text-zinc-400 light:text-slate-500 hover:text-white dark:hover:text-white light:hover:text-black"
          }`}
        >
          <Flame className={`h-5 w-5 ${isHome ? "text-violet-400 fill-violet-400/20" : ""}`} />
          <span className="text-[10px] tracking-tight">Feed</span>
        </Link>

        {/* Global Instant Search */}
        <button
          onClick={onOpenSearch}
          type="button"
          className="flex flex-col items-center justify-center gap-1 w-14 text-zinc-400 dark:text-zinc-400 light:text-slate-500 hover:text-white dark:hover:text-white light:hover:text-black transition-colors"
        >
          <Search className="h-5 w-5" />
          <span className="text-[10px] tracking-tight">Search</span>
        </button>

        {/* Center Elevated Studio Action Button */}
        <Link
          href="/creator/upload"
          className="flex flex-col items-center justify-center -mt-5"
          title="Creator Studio Upload"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 via-fuchsia-600 to-pink-500 p-0.5 shadow-lg shadow-violet-600/40 transition-transform active:scale-95">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-zinc-950/40">
              <Plus className="h-6 w-6 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <span className="text-[9px] font-bold text-violet-400 mt-1 uppercase tracking-wider">Studio</span>
        </Link>

        {/* The Codex */}
        <Link
          href="/codex"
          className={`flex flex-col items-center justify-center gap-1 w-14 transition-colors ${
            isCodex
              ? "text-violet-400 font-bold"
              : "text-zinc-400 dark:text-zinc-400 light:text-slate-500 hover:text-white dark:hover:text-white light:hover:text-black"
          }`}
        >
          <BookOpen className={`h-5 w-5 ${isCodex ? "text-violet-400" : ""}`} />
          <span className="text-[10px] tracking-tight">Codex</span>
        </Link>

        {/* User Account / Mon Espace */}
        <Link
          href={user ? "/dashboard" : "/auth/login"}
          className={`flex flex-col items-center justify-center gap-1 w-14 transition-colors ${
            isDashboard
              ? "text-violet-400 font-bold"
              : "text-zinc-400 dark:text-zinc-400 light:text-slate-500 hover:text-white dark:hover:text-white light:hover:text-black"
          }`}
        >
          {user ? (
            <div className="relative h-5 w-5 overflow-hidden rounded-full border border-violet-400">
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            </div>
          ) : (
            <User className="h-5 w-5" />
          )}
          <span className="text-[10px] tracking-tight">{user ? "Espace" : "Login"}</span>
        </Link>
      </div>
    </nav>
  );
}
