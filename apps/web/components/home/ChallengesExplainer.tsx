import { ChallengeIcon, GoalIcon, UsersIcon } from "@krizaka/icons";
import { CHALLENGE_MAX_DELIVERY_DAYS, CHALLENGE_MIN_GOAL_CENTS, CHALLENGE_MIN_OPEN_CALL_CENTS, CHALLENGE_REQUEST_RESPONSE_MS } from "@orochia/payments";
import Link from "next/link";
import React from "react";

import { buttonVariants, cn } from "@/components/ui";
import { t } from "@/lib/i18n";
import { money } from "@/lib/money";

const KINDS = [
  ["goal", GoalIcon],
  ["dare", ChallengeIcon],
  ["openCall", UsersIcon],
] as const;

/**
 * The challenges band while none is open: the three kinds (a goal, a dare, an open call) with their real thresholds
 * (packages/payments/src/challenge-rules.ts), the promise that matters — pledges are held until the video is delivered —
 * and the way in. Never a sample challenge.
 */
export function ChallengesExplainer() {
  const vars = {
    goal: money(CHALLENGE_MIN_GOAL_CENTS),
    openCall: money(CHALLENGE_MIN_OPEN_CALL_CENTS),
    hours: CHALLENGE_REQUEST_RESPONSE_MS / 3_600_000,
    days: CHALLENGE_MAX_DELIVERY_DAYS,
  };
  return (
    <div className="kz-spotlight relative overflow-hidden rounded-3xl border border-border-default bg-surface-1/70 p-6 backdrop-blur-xl sm:p-8">
      <div className="grid gap-4 md:grid-cols-3">
        {KINDS.map(([key, Icon], i) => (
          <div
            key={key}
            data-reveal
            style={{ ["--kz-delay" as string]: `${i * 110}ms` }}
            className="rounded-2xl border border-border-default bg-surface-2/60 p-5"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-fg-accent">
              <Icon size={20} nodeColor="var(--kz-accent-2)" />
            </span>
            <p className="mt-4 text-sm font-bold text-fg">{t(`home.challengesHow.${key}.title`)}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-fg-secondary">{t(`home.challengesHow.${key}.body`, vars)}</p>
          </div>
        ))}
      </div>
      <div className="mt-7 flex flex-col items-start justify-between gap-4 border-t border-border-default pt-5 sm:flex-row sm:items-center">
        <div className="max-w-2xl">
          <p className="font-display text-lg font-bold text-fg">{t("home.challenges.pitch")}</p>
          <p className="mt-1 text-sm text-fg-secondary">{t("home.challenges.body", vars)}</p>
        </div>
        <Link href="/challenges" className={cn(buttonVariants({ variant: "primary", size: "md", shape: "pill" }), "kz-sheen shrink-0 gap-2")}>
          <ChallengeIcon size={18} /> {t("home.challenges.cta")}
        </Link>
      </div>
    </div>
  );
}
