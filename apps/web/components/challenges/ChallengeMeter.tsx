"use client";

import { AuctionIcon as Gavel, ChallengeIcon as Flame, GoalIcon as Target, UsersIcon as Megaphone } from "@krizaka/icons";
import React from "react";

import { cn, LiveBadge, Progress } from "@/components/ui";
import type { ChallengeCardView } from "@/lib/challenges";
import { t } from "@/lib/i18n";
import { money } from "@/lib/money";

export const KIND_ICONS = {
  GOAL: Target,
  REQUEST: Flame,
  OPEN_CALL: Megaphone,
} as const;

/** A challenge's stage as a badge: pulsing while it moves (taking pledges, waiting, in progress), still once it is final. */
export function ChallengeStageBadge({ stage, className }: { stage: ChallengeCardView["stage"]; className?: string }) {
  const tone =
    stage === "GOAL_REACHED" || stage === "DELIVERED"
      ? "success"
      : stage === "FUNDING" || stage === "AWAITING_ANSWER" || stage === "CASTING" || stage === "IN_PROGRESS"
        ? "live"
        : stage === "CLOSING"
          ? "upcoming"
          : "muted";
  return <LiveBadge label={t(`challenge.stage.${stage}`)} tone={tone} className={className} />;
}

const RING = { sm: "h-18 w-18", md: "h-28 w-28", lg: "h-42 w-42" } as const;

/**
 * The pot, on @krizaka/ui's `Progress` ring (accent role, both themes): it fills towards the goal (a goal), or with the
 * amount pledged up to $100 (a request, an open call — they have no target). The ring's sweep animates on change and
 * stays still under reduced motion; the centre pops when `pulse` changes (a new pledge).
 */
export function ChallengeMeter({
  c,
  size = "md",
  pulse = 0,
}: {
  c: Pick<ChallengeCardView, "kind" | "goalCents" | "pledgedCents" | "progress" | "backersCount">;
  size?: "sm" | "md" | "lg";
  pulse?: number;
}) {
  const ratio = c.progress === null ? Math.min(1, c.pledgedCents / 100_00) : Math.min(1, c.progress);
  const Icon = c.kind === "GOAL" ? Target : c.kind === "REQUEST" ? Flame : Gavel;
  const valueText =
    c.goalCents !== null
      ? t("challenge.ofGoal", { goal: money(c.goalCents), percent: Math.round((c.progress ?? 0) * 100) })
      : money(c.pledgedCents);
  return (
    <Progress variant="ring" size={size} value={ratio * 100} label={t("challenge.meterLabel")} valueText={`${money(c.pledgedCents)} · ${valueText}`} className={RING[size]}>
      <span key={pulse} className={cn("flex flex-col items-center", pulse ? "cm-pop" : "")}>
        {size !== "sm" && <Icon className="mb-0.5 h-4 w-4 text-fg-accent" aria-hidden />}
        <span className={cn("font-display font-black tabular-nums text-fg", size === "lg" ? "text-2xl" : size === "md" ? "text-base" : "text-xs")}>
          {money(c.pledgedCents)}
        </span>
        {size !== "sm" && c.goalCents !== null && <span className="text-[10px] font-semibold text-fg-secondary">{valueText}</span>}
      </span>
      <style>{STYLES}</style>
    </Progress>
  );
}

const STYLES = `
  .cm-pop { animation: cm-pop .5s cubic-bezier(.16,1,.3,1); }
  @keyframes cm-pop { 40% { transform: scale(1.08); } }
  @media (prefers-reduced-motion: reduce) { .cm-pop { animation: none; } }
`;
