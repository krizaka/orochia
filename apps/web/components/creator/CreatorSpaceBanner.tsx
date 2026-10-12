"use client";

import { CreatorIcon } from "@krizaka/icons";
import Link from "next/link";
import React from "react";

import { buttonVariants } from "@/components/ui";
import type { UserProfile } from "@/lib/auth-context";
import { creatorSpaceCta, viewerStateOf } from "@/lib/creator-journey";
import { t } from "@/lib/i18n";

/**
 * On the dashboard of a member or of a creator waiting for the 2257 review: the creator space of this account, one tap
 * away — open it, or read where its review stands. Nothing for a verified creator (the studio is already there).
 */
export function CreatorSpaceBanner({ user }: { user: Pick<UserProfile, "role" | "isVerified"> }) {
  const state = viewerStateOf({ role: user.role, isVerified: user.isVerified ?? true });
  if (state !== "member" && state !== "creator-pending") return null;
  const cta = creatorSpaceCta(state)!;
  const key = state === "member" ? "member" : "pending";
  return (
    <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-border-default bg-surface-1/70 p-5 sm:flex-row sm:items-center">
      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-fg-accent">
        <CreatorIcon size={22} nodeColor="var(--kz-accent-2)" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-bold text-fg">{t(`creatorSpace.banner.${key}.title`)}</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-fg-secondary">{t(`creatorSpace.banner.${key}.body`)}</p>
      </div>
      <Link href={cta.href} className={buttonVariants({ variant: state === "member" ? "primary" : "secondary", size: "sm", shape: "pill" })}>
        {t(cta.label)}
      </Link>
    </div>
  );
}
