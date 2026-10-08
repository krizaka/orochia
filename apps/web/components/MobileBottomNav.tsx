"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Compass, Flame, LogIn, Plus } from "lucide-react";
import { AVATAR_PLACEHOLDER, useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";

/**
 * The phone navigation, five equal tabs with Create in the middle: Home · Explore · Create · Saved ·
 * Account (or Sign in). Signing
 * in, the account and creating exist only here on a phone — the top bar keeps brand, search, theme.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const tab = (active: boolean) =>
    `flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
      active ? "text-violet-400 light:text-violet-700" : "text-zinc-400 light:text-slate-500"
    }`;
  const accountActive = pathname.startsWith("/dashboard") || pathname.startsWith("/auth");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 light:border-black/10 bg-zinc-950/90 light:bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden">
      <div className="grid h-16 grid-cols-5 items-center px-1">
        <Link href="/" className={tab(pathname === "/")}>
          <Flame className="h-5 w-5" /> {t("nav.home")}
        </Link>
        <Link href="/explore" className={tab(pathname.startsWith("/explore"))}>
          <Compass className="h-5 w-5" /> {t("nav.explore")}
        </Link>
        <Link href={user ? "/creator/upload" : "/auth/register"} className="-mt-5 flex flex-col items-center justify-self-center" aria-label={t("nav.create")}>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 via-fuchsia-600 to-pink-500 shadow-lg shadow-violet-600/40 active:scale-95">
            <Plus className="h-6 w-6 text-white" strokeWidth={2.5} />
          </span>
          <span className="mt-1 text-[10px] font-semibold text-violet-400 light:text-violet-700">{t("nav.create")}</span>
        </Link>
        <Link href={user ? "/dashboard?tab=playlists" : "/auth/login?next=/dashboard?tab=playlists"} className={tab(false)}>
          <Bookmark className="h-5 w-5" /> {t("nav.saved")}
        </Link>
        {user ? (
          <Link href="/dashboard" className={tab(accountActive)}>
            <img src={user.avatarUrl || AVATAR_PLACEHOLDER} alt="" className={`h-6 w-6 rounded-full object-cover ${accountActive ? "ring-2 ring-violet-500" : ""}`} />
            {t("nav.account")}
          </Link>
        ) : (
          <Link href="/auth/login" className={tab(accountActive)}>
            <LogIn className="h-5 w-5" /> {t("nav.signIn")}
          </Link>
        )}
      </div>
    </nav>
  );
}
