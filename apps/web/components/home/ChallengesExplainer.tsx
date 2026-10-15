import { ChallengeIcon, GoalIcon, UsersIcon } from "@krizaka/icons";
import { CHALLENGE_MAX_DELIVERY_DAYS, CHALLENGE_MIN_GOAL_CENTS, CHALLENGE_MIN_OPEN_CALL_CENTS, CHALLENGE_REQUEST_RESPONSE_MS } from "@orochia/payments";
import { CardGrid } from "@krizaka/ui/card-grid";
import { LinkCard } from "@krizaka/ui/link-card";
import Link from "next/link";
import React from "react";

import { Button } from "@/components/ui";
import { t } from "@/lib/i18n";
import { challengeStartHref, CHALLENGE_STARTS } from "@/lib/challenge-kinds";
import { money } from "@/lib/money";

const ICONS = { goal: GoalIcon, dare: ChallengeIcon, call: UsersIcon } as const;

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
      <CardGrid min={220} light>
        {CHALLENGE_STARTS.map(({ slug, messageKey }) => {
          const Icon = ICONS[slug];
          return (
            <LinkCard
              key={slug}
              href={challengeStartHref(slug)}
              linkAs={Link}
              icon={<Icon size={20} nodeColor="var(--kz-accent-2)" />}
              title={t(`home.challengesHow.${messageKey}.title`)}
              description={t(`home.challengesHow.${messageKey}.body`, vars)}
              cta={t("challenges.startCta")}
            />
          );
        })}
      </CardGrid>
      <div className="mt-7 flex flex-col items-start justify-between gap-4 border-t border-border-default pt-5 sm:flex-row sm:items-center">
        <div className="max-w-2xl">
          <p className="font-display text-lg font-bold text-fg">{t("home.challenges.pitch")}</p>
          <p className="mt-1 text-sm text-fg-secondary">{t("home.challenges.body", vars)}</p>
        </div>
        <Button asChild variant="primary" shape="cut" shimmer className="shrink-0 gap-2">
          <Link href="/challenges">
            <ChallengeIcon size={18} /> {t("home.challenges.cta")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
