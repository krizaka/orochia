"use client";

import { AuctionIcon, ChallengeIcon, GlobeIcon, HomeIcon, PlusIcon } from "@krizaka/icons";
import { RailNav } from "@krizaka/ui/rail-nav";
import Link from "next/link";
import React from "react";

import { OrochiaLogo } from "@/components/ui";
import { isCurrent, RAIL_ITEMS } from "@/lib/app-nav";
import { useAuth } from "@/lib/auth-context";
import { creatorSpaceCta, viewerStateOf } from "@/lib/creator-journey";
import { useI18n } from "@/lib/i18n-client";
import { usePathname } from "@/lib/use-pathname";

const ICONS = { home: HomeIcon, explore: GlobeIcon, auctions: AuctionIcon, challenges: ChallengeIcon } as const;

/** The rail: Home · Explore · Auctions · Challenges, and Create at the foot. On a phone it is the bottom tab bar. */
export function AppRail() {
  const { t } = useI18n();
  const pathname = usePathname();
  const { user, isLoading, signupEnabled } = useAuth();
  // Create: upload (verified creator), the creator application (member, pending), sign up first (visitor).
  // While the session is read, /creator/upload: the server sends each viewer to their own step.
  const create = creatorSpaceCta(viewerStateOf(user ? { role: user.role, isVerified: user.isVerified ?? true } : null), signupEnabled);
  const createHref = isLoading ? "/creator/upload" : (create?.href ?? "/");

  return (
    <RailNav.Root
      label="Orochia"
      accent="orochia"
      mark={
        <Link href="/" aria-label="Orochia">
          <OrochiaLogo size={28} />
        </Link>
      }
      footer={
        <RailNav.Item asChild icon={<PlusIcon size={22} />} label={t("nav.create")} current={isCurrent(pathname, "/creator")}>
          <Link href={createHref} />
        </RailNav.Item>
      }
    >
      {RAIL_ITEMS.map((item) => {
        const Icon = ICONS[item.id];
        return (
          <RailNav.Item key={item.id} asChild icon={<Icon size={22} />} label={t(item.labelKey)} current={isCurrent(pathname, item.href)}>
            <Link href={item.href} />
          </RailNav.Item>
        );
      })}
    </RailNav.Root>
  );
}
