"use client";

import React from "react";
import { Flame, Gavel, Megaphone, Target } from "lucide-react";
import { LiveBadge } from "@/components/ui";
import { usd } from "@/components/money/format";
import { t } from "@/lib/i18n";
import type { ChallengeCardView } from "@/lib/challenges";

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

/**
 * The pot: a ring that fills towards the goal (a goal), or the amount pledged with a flame that grows with it (a request,
 * an open call — they have no target). The ring's sweep animates on change; it stays still under reduced motion.
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
  const px = size === "lg" ? 168 : size === "md" ? 112 : 72;
  const stroke = size === "sm" ? 6 : 9;
  const r = (px - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const ratio = c.progress === null ? Math.min(1, c.pledgedCents / 100_00) : Math.min(1, c.progress);
  const Icon = c.kind === "GOAL" ? Target : c.kind === "REQUEST" ? Flame : Gavel;
  return (
    <div className="relative shrink-0" style={{ width: px, height: px }}>
      <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={`cm-${size}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--color-violet-500)" }} />
            <stop offset="55%" style={{ stopColor: "var(--color-fuchsia-500)" }} />
            <stop offset="100%" style={{ stopColor: "var(--color-pink-500)" }} />
          </linearGradient>
        </defs>
        <circle cx={px / 2} cy={px / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-white/10 light:stroke-black/5" />
        <circle
          cx={px / 2}
          cy={px / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={`url(#cm-${size})`}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className="cm-sweep"
        />
      </svg>
      <div key={pulse} className={`absolute inset-0 flex flex-col items-center justify-center text-center ${pulse ? "cm-pop" : ""}`}>
        {size !== "sm" && <Icon className="mb-0.5 h-4 w-4 text-fuchsia-400 light:text-fuchsia-600" aria-hidden />}
        <span
          className={`font-display font-black tabular-nums text-white light:text-slate-900 ${size === "lg" ? "text-2xl" : size === "md" ? "text-base" : "text-xs"}`}
        >
          {usd(c.pledgedCents)}
        </span>
        {size !== "sm" && c.goalCents !== null && (
          <span className="text-[10px] font-semibold text-zinc-400 light:text-slate-500">
            {t("challenge.ofGoal", {
              goal: usd(c.goalCents),
              percent: Math.round((c.progress ?? 0) * 100),
            })}
          </span>
        )}
      </div>
      <style>{STYLES}</style>
    </div>
  );
}

const STYLES = `
  .cm-sweep { transition: stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1); }
  .cm-pop { animation: cm-pop .5s cubic-bezier(.16,1,.3,1); }
  @keyframes cm-pop { 40% { transform: scale(1.08); } }
  @media (prefers-reduced-motion: reduce) { .cm-sweep { transition: none; } .cm-pop { animation: none; } }
`;
