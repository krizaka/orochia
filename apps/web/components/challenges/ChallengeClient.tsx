"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Clapperboard, Clock, Crown, Lock, Play, Timer, Users } from "lucide-react";
import { Countdown, buttonClass } from "@/components/ui";
import { money } from "@/lib/money";
import { AVATAR_PLACEHOLDER } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { ChallengeActions } from "./ChallengeActions";
import { UNITS } from "./ChallengeCard";
import { ChallengeMeter, ChallengeStageBadge, KIND_ICONS } from "./ChallengeMeter";
import { PledgeBox } from "./PledgeBox";
import { useChallengeStream } from "./useChallengeStream";

const panel = "rounded-2xl border border-white/10 bg-zinc-950/60 p-5 light:border-black/5 light:bg-white";

/**
 * One challenge, kept current: the pot fills as pledges land (every viewer sees them, by alias), the clock counts down
 * to the deadline or the delivery, and each person gets their own actions in place — back it, answer it, start it,
 * apply, pick, deliver, withdraw. Once delivered, its backers watch the video or the story from here.
 */
export function ChallengeClient({ id }: { id: string }) {
  const { challenge: c, loaded, skewMs, pulse, reload } = useChallengeStream(id);
  if (!loaded) return <div className="mx-auto h-96 max-w-6xl animate-pulse rounded-3xl bg-white/5 light:bg-black/5" />;
  if (!c) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-dashed border-white/10 p-10 text-center light:border-black/10">
        <p className="text-sm font-semibold text-white light:text-slate-900">{t("challenge.errors.NOT_FOUND")}</p>
        <Link href="/challenges" className={buttonClass({ variant: "secondary", className: "mt-4" })}>
          {t("challenge.backToAll")}
        </Link>
      </div>
    );
  }
  const KindIcon = KIND_ICONS[c.kind];
  const ticking = c.stage === "FUNDING" || c.stage === "GOAL_REACHED" || c.stage === "AWAITING_ANSWER" || c.stage === "CASTING";

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/challenges"
        className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white light:text-slate-500 hover:light:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> {t("challenge.backToAll")}
      </Link>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          <header className="space-y-3" data-reveal>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-fuchsia-300 light:text-fuchsia-700">
                <KindIcon className="h-3.5 w-3.5" aria-hidden /> {t(`challenge.kind.${c.kind}`)}
              </span>
              <ChallengeStageBadge stage={c.stage} />
            </div>
            <h1 className="font-display text-2xl font-black text-white sm:text-3xl light:text-slate-900">{c.title}</h1>
            {c.creator ? (
              <Link
                href={`/@${c.creator.username}`}
                className="inline-flex items-center gap-2 text-sm text-zinc-300 hover:text-white light:text-slate-600 hover:light:text-slate-900"
              >
                <img src={c.creator.avatarUrl || AVATAR_PLACEHOLDER} alt="" className="h-7 w-7 rounded-full object-cover" />
                <span>{t(c.kind === "GOAL" ? "challenge.byCreator" : "challenge.forCreator", { name: c.creator.name })}</span>
              </Link>
            ) : (
              <p className="text-sm text-zinc-400 light:text-slate-500">{t("challenge.openToAll")}</p>
            )}
            {c.requestedBy && (
              <p className="text-xs text-zinc-400 light:text-slate-500">
                {t("challenge.requestedBy", {
                  username: c.requestedBy.username,
                })}
              </p>
            )}
          </header>

          <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-300 light:text-slate-700">{c.description}</p>
          <ul className="flex flex-wrap gap-2 text-[11px] font-semibold text-zinc-300 light:text-slate-600">
            <li className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 light:border-black/10">
              <Clapperboard className="h-3 w-3" aria-hidden /> {t(`challenge.deliverable.${c.deliverable}`)}
            </li>
            <li className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 light:border-black/10">
              {c.reward === "BACKERS" ? <Lock className="h-3 w-3" aria-hidden /> : <Users className="h-3 w-3" aria-hidden />}{" "}
              {t(`challenge.reward.${c.reward}`)}
            </li>
            <li className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 light:border-black/10">
              <Timer className="h-3 w-3" aria-hidden /> {t("challenge.deliveryDays", { days: c.deliveryDays })}
            </li>
          </ul>

          {c.delivered && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.07] p-4">
              <p className="text-sm font-semibold text-emerald-200 light:text-emerald-800">
                {t(c.delivered.canWatch ? "challenge.delivered.watch" : "challenge.delivered.locked")}
              </p>
              {c.delivered.canWatch && c.delivered.videoId && (
                <Link href={`/watch/${c.delivered.videoId}`} className={buttonClass({ variant: "primary", size: "sm" })}>
                  <Play className="h-4 w-4" aria-hidden /> {t("challenge.delivered.cta")}
                </Link>
              )}
              {c.delivered.canWatch && c.delivered.storyId && (
                <Link href="/" className={buttonClass({ variant: "primary", size: "sm" })}>
                  {t("challenge.delivered.storyCta")}
                </Link>
              )}
            </div>
          )}

          <ChallengeActions c={c} onChanged={() => void reload()} />

          <section className={panel}>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-400 light:text-slate-500">{t("challenge.recent")}</h2>
            {c.recentPledges.length === 0 ? (
              <p className="text-sm text-zinc-500">{t("challenge.noPledges")}</p>
            ) : (
              <ol className="divide-y divide-white/5 light:divide-black/5" aria-live="polite">
                {c.recentPledges.map((p, i) => (
                  <li key={p.id} className={`flex items-center justify-between py-2 text-sm ${i === 0 && pulse ? "kz-fade" : ""}`}>
                    <span className="text-zinc-300 light:text-slate-700">{p.mine ? t("challenge.you") : t("challenge.backer", { n: p.alias })}</span>
                    <span className="font-mono font-semibold tabular-nums text-white light:text-slate-900">+{money(p.amountCents)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* On phones the pot comes first: it is what a visitor opens a challenge for. */}
        <aside className="order-first space-y-4 lg:sticky lg:top-20 lg:order-none lg:self-start">
          <div className={`${panel} flex flex-col items-center gap-4 text-center`}>
            <ChallengeMeter c={c} size="lg" pulse={pulse} />
            <p className="text-xs text-zinc-400 light:text-slate-500">{t("challenge.backers", { count: c.backersCount })}</p>
            {ticking && (
              <Countdown
                label={t(c.kind === "REQUEST" ? "challenge.answerIn" : c.kind === "OPEN_CALL" ? "challenge.pickIn" : "challenge.endsIn")}
                target={c.deadline}
                skewMs={skewMs}
                units={UNITS()}
                size="md"
              />
            )}
            {c.stage === "IN_PROGRESS" && c.deliveryDeadline && (
              <Countdown label={t("challenge.deliverIn")} target={c.deliveryDeadline} skewMs={skewMs} units={UNITS()} size="md" />
            )}
            {c.stage === "GOAL_REACHED" && <p className="text-xs font-semibold text-emerald-300 light:text-emerald-700">{t("challenge.goalReachedHint")}</p>}
            {!ticking && c.stage !== "IN_PROGRESS" && (
              <p className="inline-flex items-center gap-1 text-xs text-zinc-400 light:text-slate-500">
                <Clock className="h-3.5 w-3.5" aria-hidden /> {t(`challenge.final.${c.stage as "DELIVERED"}`)}
              </p>
            )}
          </div>
          {c.viewer.canPledge && <PledgeBox c={c} onPledged={() => void reload()} />}
          {c.topBackers.length > 0 && (
            <section className={panel}>
              <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400 light:text-slate-500">
                <Crown className="h-3.5 w-3.5 text-amber-400" aria-hidden /> {t("challenge.leaderboard")}
              </h2>
              <ol className="space-y-1.5">
                {c.topBackers.map((b, i) => (
                  <li key={b.alias} className="flex items-center gap-3 text-sm">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${i === 0 ? "bg-amber-400 text-amber-950" : "bg-white/10 text-zinc-300 light:bg-black/5 light:text-slate-600"}`}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 text-zinc-300 light:text-slate-700">{b.mine ? t("challenge.you") : t("challenge.backer", { n: b.alias })}</span>
                    <span className="font-mono font-semibold tabular-nums text-white light:text-slate-900">{money(b.totalCents)}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
