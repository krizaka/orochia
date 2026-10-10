"use client";

import { ClockIcon as Clock, UsersIcon as Users, VideoIcon as Clapperboard } from "@krizaka/icons";
import Link from "next/link";
import React from "react";

import { Avatar, Card, Countdown } from "@/components/ui";
import { AVATAR_PLACEHOLDER } from "@/lib/auth-context";
import type { ChallengeCardView } from "@/lib/challenges";
import { t } from "@/lib/i18n";

import { ChallengeMeter, ChallengeStageBadge, KIND_ICONS } from "./ChallengeMeter";

/** A challenge in a list: kind, stage, the pot, the clock and who makes it — the whole card opens it. */
export function ChallengeCard({ challenge: c, index = 0 }: { challenge: ChallengeCardView; index?: number }) {
  const KindIcon = KIND_ICONS[c.kind];
  return (
    <Card.Root asChild interactive tone="glass" reveal={index}>
      <Link href={`/challenges/${c.id}`}>
        <Card.Body className="gap-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-fg-accent">
              <KindIcon className="h-3.5 w-3.5" aria-hidden /> {t(`challenge.kind.${c.kind}`)}
            </span>
            <ChallengeStageBadge stage={c.stage} />
          </div>
          <div className="flex items-center gap-4">
            <ChallengeMeter c={c} size="sm" />
            <div className="min-w-0">
              <Card.Title className="line-clamp-2 font-bold">{c.title}</Card.Title>
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
          <Card.Footer className="justify-between gap-3">
            {c.creator ? (
              <span className="flex min-w-0 items-center gap-2">
                <Avatar size="xs" src={c.creator.avatarUrl || AVATAR_PLACEHOLDER} fallback={c.creator.name.charAt(0)} />
                <span className="truncate">{c.creator.name}</span>
              </span>
            ) : (
              <span>{t("challenge.anyCreator")}</span>
            )}
            <ChallengeClock c={c} />
          </Card.Footer>
        </Card.Body>
      </Link>
    </Card.Root>
  );
}

/** The clock that matters at this stage: the deadline while it moves, the delivery date while in progress. */
function ChallengeClock({ c }: { c: ChallengeCardView }) {
  const ticking = c.stage === "FUNDING" || c.stage === "GOAL_REACHED" || c.stage === "AWAITING_ANSWER" || c.stage === "CASTING";
  if (ticking) {
    const label = c.kind === "REQUEST" ? "challenge.answerIn" : c.kind === "OPEN_CALL" ? "challenge.pickIn" : "challenge.endsIn";
    return <Countdown label={t(label)} target={c.deadline} size="sm" />;
  }
  if (c.stage === "IN_PROGRESS" && c.deliveryDeadline) return <Countdown label={t("challenge.deliverIn")} target={c.deliveryDeadline} size="sm" />;
  return <Clock className="h-3.5 w-3.5" aria-hidden />;
}
