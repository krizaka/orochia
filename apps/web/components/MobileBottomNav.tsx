"use client";

import { BookmarkIcon, GlobeIcon, HomeIcon, MessageIcon, PlusIcon, UserIcon } from "@krizaka/icons";
import Link from "next/link";
import { usePathname } from "@/lib/use-pathname";
import React from "react";

import { useUnreadMessages } from "@/components/messages/useUnreadMessages";
import { Avatar, cn } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { bottomNavLeaf } from "@/lib/bottom-nav";
import { creatorSpaceCta, viewerStateOf } from "@/lib/creator-journey";
import { useI18n } from "@/lib/i18n-client";
import { defaultAvatarFor } from "@/lib/presets";

/**
 * The phone navigation, five equal tabs with Create in the middle: Home · Explore · Create · Messages (Saved for a visitor) ·
 * Account (or Sign in). Signing
 * in, the account and creating exist only here on a phone — the top bar keeps brand, search, theme.
 */
export function MobileBottomNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const { user, isLoading, signupEnabled } = useAuth();
  // Create: upload (verified creator), the creator application of this account (member, pending), sign up first (visitor).
  // While the session is read, /creator/upload: the server sends each viewer to their own step.
  const create = creatorSpaceCta(viewerStateOf(user ? { role: user.role, isVerified: user.isVerified ?? true } : null), signupEnabled);
  const tab = (active: boolean) =>
    `flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
      active ? "text-fg-accent" : "text-fg-secondary"
    }`;
  const unreadMessages = useUnreadMessages(Boolean(user));
  const accountActive = pathname === "/me" || pathname.startsWith("/me/") || pathname.startsWith("/auth");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border-default bg-surface-1/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden">
      <div className="grid h-16 grid-cols-5 items-center px-1">
        <Link href="/" className={tab(pathname === "/")}>
          <HomeIcon size={22} nodeColor={pathname === "/" ? "var(--kz-accent-2)" : undefined} /> {t("nav.home")}
        </Link>
        <Link href="/explore" className={tab(pathname.startsWith("/explore"))}>
          <GlobeIcon size={22} /> {t("nav.explore")}
        </Link>
        <Link href={isLoading ? "/creator/upload" : (create?.href ?? "/")} className="-mt-5 flex flex-col items-center justify-self-center" aria-label={t("nav.create")}>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-tr from-accent via-accent-2 to-accent-2 shadow-lg shadow-accent/40 active:scale-95">
            <PlusIcon size={24} className="text-on-accent" strokeWidth={2.25} />
          </span>
          <span className="mt-1 text-[10px] font-semibold text-fg-accent">{t("nav.create")}</span>
        </Link>
        {bottomNavLeaf(Boolean(user)) === "messages" ? (
          <Link href="/messages" className={cn(tab(pathname.startsWith("/messages")), "relative")} aria-label={unreadMessages ? `${t("nav.messages")} — ${t("inbox.unreadCount", { count: unreadMessages })}` : undefined}>
            <span className="relative">
              <MessageIcon size={22} />
              {unreadMessages > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-2 px-1 text-[9px] font-bold text-on-accent ring-2 ring-surface-1">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              )}
            </span>
            {t("nav.messages")}
          </Link>
        ) : (
          <Link href="/auth/login?next=/me/collections" className={tab(false)}>
            <BookmarkIcon size={22} /> {t("nav.saved")}
          </Link>
        )}
        {isLoading ? (
          <span aria-hidden className={tab(false)} />
        ) : user ? (
          <Link href="/me" className={tab(accountActive)}>
            <Avatar size="xs" src={user.avatarUrl} defaultAvatar={{ brand: "orochia", seed: user.displayName }} fallbackSrc={defaultAvatarFor(user.displayName)} fallback={user.displayName.charAt(0)} className={cn("h-6 w-6", accountActive && "ring-2 ring-ring")} />
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
