"use client";

import React from "react";
import Link from "next/link";
import { Clapperboard, Clock, Users } from "lucide-react";
import { Avatar, Countdown } from "@/components/ui";
import { AVATAR_PLACEHOLDER } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import type { ChallengeCardView } from "@/lib/challenges";
import { ChallengeMeter, ChallengeStageBadge, KIND_ICONS } from "./ChallengeMeter";

export const UNITS = () => ({
  d: t("auction.units.d"),
  h: t("auction.units.h"),
  m: t("auction.units.m"),
  s: t("auction.units.s"),
});

/** A challenge in a list: kind, stage, the pot, the clock and who makes it — the whole card opens it. */
export function ChallengeCard({ challenge: c, index = 0 }: { challenge: ChallengeCardView; index?: number }) {
  const KindIcon = KIND_ICONS[c.kind];
  const ticking = c.stage === "FUNDING" || c.stage === "GOAL_REACHED" || c.stage === "AWAITING_ANSWER" || c.stage === "CASTING";
  return (
    <Link
      href={`/challenges/${c.id}`}
      data-reveal
      style={{ "--kz-delay": `${Math.min(index, 8) * 50}ms` } as React.CSSProperties}
      className="kz-spotlight kz-lift group flex flex-col gap-4 overflow-hidden rounded-2xl border border-border-default bg-surface-1/70 p-5 transition-colors hover:border-accent/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-accent">
          <KindIcon className="h-3.5 w-3.5" aria-hidden /> {t(`challenge.kind.${c.kind}`)}
        </span>
        <ChallengeStageBadge stage={c.stage} />
      </div>
      <div className="flex items-center gap-4">
        <ChallengeMeter c={c} size="sm" />
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-bold text-fg group-hover:text-accent">
            {c.title}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-secondary">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden /> {t("challenge.backers", { count: c.backersCount })}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clapperboard className="h-3 w-3" aria-hidden /> {t(`challenge.deliverable.${c.deliverable}`)}
            </span>
            {c.kind === "OPEN_CALL" && c.stage === "CASTING" && <span>{t("challenge.applicants", { count: c.applicationsCount })}</span>}
          </p>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border-subtle pt-3 text-xs text-fg-secondary">
        {c.creator ? (
          <span className="flex min-w-0 items-center gap-2">
            <Avatar size="xs" src={c.creator.avatarUrl || AVATAR_PLACEHOLDER} fallback={c.creator.name.charAt(0)} />
            <span className="truncate">{c.creator.name}</span>
          </span>
        ) : (
          <span>{t("challenge.anyCreator")}</span>
        )}
        {ticking ? (
          <Countdown
            label={t(c.kind === "REQUEST" ? "challenge.answerIn" : c.kind === "OPEN_CALL" ? "challenge.pickIn" : "challenge.endsIn")}
            target={c.deadline}
            units={UNITS()}
            size="sm"
          />
        ) : c.stage === "IN_PROGRESS" && c.deliveryDeadline ? (
          <Countdown label={t("challenge.deliverIn")} target={c.deliveryDeadline} units={UNITS()} size="sm" />
        ) : (
          <Clock className="h-3.5 w-3.5" aria-hidden />
        )}
      </div>
    </Link>
  );
}
