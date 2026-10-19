"use client";

import {
  CreatorIcon,
  CreditsIcon,
  LogoutIcon,
  MessageIcon,
  PlayIcon,
  SearchIcon,
  SettingsIcon,
  WalletIcon,
} from "@krizaka/icons";
import { AccountMenu } from "@krizaka/ui/account-menu";
import { AppHeader } from "@krizaka/ui/app-header";
import Link from "next/link";
import React from "react";

import { LanguageSwitch } from "@/components/LanguageSwitch";
import { MessagesButton } from "@/components/messages/MessagesButton";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { buttonVariants, IconButton, OrochiaLogo, ThemeToggle } from "@/components/ui";
import { type AccountLinkId,accountLinks } from "@/lib/app-nav";
import { useAuth } from "@/lib/auth-context";
import { creatorSpaceCta, viewerStateOf } from "@/lib/creator-journey";
import { useI18n } from "@/lib/i18n-client";
import { defaultAvatarFor } from "@/lib/presets";

const ICONS: Record<AccountLinkId, React.ReactNode> = {
  dashboard: <CreatorIcon size={16} />,
  earnings: <WalletIcon size={16} />,
  messages: <MessageIcon size={16} />,
  wallet: <CreditsIcon size={16} />,
  mobile: <PlayIcon size={16} />,
  settings: <SettingsIcon size={16} />,
};

/**
 * The app's top bar, @krizaka/ui's `AppHeader`: the name (the mark on a phone; the rail carries it on a desktop), search,
 * language, theme, and for an account its messages, bell and `AccountMenu` (the creator's balance is on the Earnings row);
 * for a visitor Sign in and Join. Navigation is the rail (a bottom tab bar on a phone), so each destination exists once.
 */
export function AppBar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { t } = useI18n();
  const { user, isLoading, logout, signupEnabled } = useAuth();
  const isCreator = user?.role === "CREATOR" || user?.role === "ADMIN";
  const creatorSpace = creatorSpaceCta(viewerStateOf(user ? { role: user.role, isVerified: user.isVerified ?? true } : null), signupEnabled);

  return (
    <AppHeader
      className="kz-appbar"
      name="Orochia"
      mark={<OrochiaLogo size={26} />}
      homeLink={<Link href="/" aria-label="Orochia" />}
      actions={
        <>
          <button
            type="button"
            onClick={onOpenSearch}
            className="hidden w-56 items-center gap-2 rounded-2xl border border-border-default bg-surface-2/60 px-3.5 py-2 text-xs text-fg-secondary transition-colors hover:border-accent/50 md:flex lg:w-80"
          >
            <SearchIcon size={14} aria-hidden />
            <span className="flex-1 truncate text-left">{t("nav.searchPlaceholder")}</span>
            <kbd className="hidden rounded-sm border border-border-default px-1.5 font-mono text-[10px] lg:inline">⌘K</kbd>
          </button>
          <IconButton onClick={onOpenSearch} shape="rounded" className="h-9 w-9 rounded-xl md:hidden" label={t("nav.search")}>
            <SearchIcon size={20} aria-hidden />
          </IconButton>
          <LanguageSwitch />
          <ThemeToggle />
          {user ? (
            <>
              <MessagesButton />
              <NotificationBell />
              <AccountMenu
                label={t("nav.account")}
                name={user.displayName}
                email={`@${user.username}`}
                showName
                avatar={{
                  src: user.avatarUrl,
                  defaultAvatar: { brand: "orochia", seed: user.displayName },
                  fallbackSrc: defaultAvatarFor(user.displayName),
                  fallback: user.displayName.charAt(0),
                }}
                linkAs={Link}
                links={[
                  { id: "profile", label: t("nav.viewProfile"), href: `/@${user.username}`, icon: <CreatorIcon size={16} /> },
                  ...accountLinks(isCreator).map((l) => ({
                    id: l.id,
                    href: l.href,
                    icon: ICONS[l.id],
                    label: l.id === "earnings" ? `${t(l.labelKey)} · $${(user.balanceCents / 100).toFixed(2)}` : t(l.labelKey),
                  })),
                ]}
                signOut={{ label: t("nav.signOut"), onSelect: () => void logout(), icon: <LogoutIcon size={16} /> }}
              />
            </>
          ) : isLoading ? null : (
            // While the session is read, nothing: a signed-in person never sees "Join" flash by.
            <>
              <Link
                href={creatorSpace?.href ?? "/auth/login"}
                title={t("nav.uploadHint")}
                className={buttonVariants({ variant: "secondary", size: "sm", shape: "pill", className: "hidden lg:inline-flex" })}
              >
                {t("nav.upload")}
              </Link>
              <Link href="/auth/login" className={buttonVariants({ variant: "ghost", size: "sm", shape: "pill" })}>
                {t("nav.signIn")}
              </Link>
              {signupEnabled && (
                <Link href="/auth/register" className={buttonVariants({ variant: "primary", size: "sm", shape: "pill" })}>
                  {t("nav.join")}
                </Link>
              )}
            </>
          )}
        </>
      }
    />
  );
}
