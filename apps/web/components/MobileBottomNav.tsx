"use client";

import { BookmarkIcon, GlobeIcon, HomeIcon, PlusIcon, UserIcon } from "@krizaka/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

import { Avatar, cn } from "@/components/ui";
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
      active ? "text-fg-accent" : "text-fg-secondary"
    }`;
  const accountActive = pathname.startsWith("/dashboard") || pathname.startsWith("/auth");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border-default bg-surface-1/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden">
      <div className="grid h-16 grid-cols-5 items-center px-1">
        <Link href="/" className={tab(pathname === "/")}>
          <HomeIcon size={22} nodeColor={pathname === "/" ? "var(--kz-accent-2)" : undefined} /> {t("nav.home")}
        </Link>
        <Link href="/explore" className={tab(pathname.startsWith("/explore"))}>
          <GlobeIcon size={22} /> {t("nav.explore")}
        </Link>
        <Link href={user ? "/creator/upload" : "/auth/register"} className="-mt-5 flex flex-col items-center justify-self-center" aria-label={t("nav.create")}>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-tr from-accent via-accent-2 to-accent-2 shadow-lg shadow-accent/40 active:scale-95">
            <PlusIcon size={24} className="text-on-accent" strokeWidth={2.25} />
          </span>
          <span className="mt-1 text-[10px] font-semibold text-fg-accent">{t("nav.create")}</span>
        </Link>
        <Link href={user ? "/dashboard?tab=playlists" : "/auth/login?next=/dashboard?tab=playlists"} className={tab(false)}>
          <BookmarkIcon size={22} /> {t("nav.saved")}
        </Link>
        {user ? (
          <Link href="/dashboard" className={tab(accountActive)}>
            <Avatar size="xs" src={user.avatarUrl || AVATAR_PLACEHOLDER} fallback={user.displayName.charAt(0)} className={cn("h-6 w-6", accountActive && "ring-2 ring-ring")} />
            {t("nav.account")}
          </Link>
        ) : (
          <Link href="/auth/login" className={tab(accountActive)}>
            <UserIcon size={22} /> {t("nav.signIn")}
          </Link>
        )}
      </div>
    </nav>
  );
}
