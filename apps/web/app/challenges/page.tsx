import React from "react";
import Link from "next/link";
import { Flame, Megaphone, Target } from "lucide-react";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";
import { StartChallengeButton } from "@/components/challenges/StartChallengeButton";
import { buttonClass, cx } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { CHALLENGE_TABS, PERSONAL_CHALLENGE_TABS, listChallenges, type ChallengeTab } from "@/lib/challenges";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata = {
  title: t("challenges.metaTitle"),
  description: t("challenges.metaDescription"),
  alternates: { canonical: "/challenges" },
};

const KINDS = [
  { kind: "GOAL", icon: Target },
  { kind: "REQUEST", icon: Flame },
  { kind: "OPEN_CALL", icon: Megaphone },
] as const;

/**
 * Challenges: what is taking pledges (ending soonest first), open calls creators can take, what was delivered, and —
 * signed in — the creator's inbox, what the viewer wrote and what they back. The three kinds are explained up top.
 */
export default async function ChallengesPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: asked } = await props.searchParams;
  const user = await getCurrentUser();
  const tabs = CHALLENGE_TABS.filter((id) => (id === "inbox" ? user?.role === "CREATOR" : PERSONAL_CHALLENGE_TABS.includes(id) ? Boolean(user) : true));
  const tab: ChallengeTab = (tabs as readonly string[]).includes(asked ?? "") ? (asked as ChallengeTab) : "open";
  const items = await listChallenges(tab, user?.id ?? null);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between" data-reveal>
        <div>
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-fuchsia-300 light:text-fuchsia-700">
            <Flame className="h-3.5 w-3.5" /> {t("challenges.eyebrow")}
          </p>
          <h1 className="mt-2 font-display text-2xl font-black text-white sm:text-3xl light:text-slate-900">{t("challenges.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400 light:text-slate-600">{t("challenges.subtitle")}</p>
        </div>
        <StartChallengeButton signedIn={Boolean(user)} isCreator={user?.role === "CREATOR"} />
      </header>

      <ol className="mb-8 grid gap-3 sm:grid-cols-3">
        {KINDS.map(({ kind, icon: Icon }, i) => (
          <li
            key={kind}
            data-reveal
            style={{ "--kz-delay": `${i * 80}ms` } as React.CSSProperties}
            className="kz-spotlight rounded-2xl border border-white/10 bg-white/[0.03] p-4 light:border-black/5 light:bg-white"
          >
            <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-pink-600 text-white shadow-lg shadow-fuchsia-600/20">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <p className="text-sm font-bold text-white light:text-slate-900">{t(`challenge.kind.${kind}`)}</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400 light:text-slate-600">{t(`challenges.how.${kind}`)}</p>
          </li>
        ))}
      </ol>

      <nav aria-label={t("challenges.tabsLabel")} className="mb-6 flex gap-1 overflow-x-auto border-b border-white/10 light:border-black/10">
        {tabs.map((id) => (
          <Link
            key={id}
            href={id === "open" ? "/challenges" : `/challenges?tab=${id}`}
            aria-current={tab === id ? "page" : undefined}
            className={cx(
              "-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-violet-400",
              tab === id
                ? "border-fuchsia-500 text-white light:text-slate-900"
                : "border-transparent text-zinc-400 hover:text-white light:text-slate-500 hover:light:text-slate-900",
            )}
          >
            {t(`challenges.tabs.${id}`)}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <div className="kz-fade rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center light:border-black/10">
          <Flame className="mx-auto h-8 w-8 text-fuchsia-400/70" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-white light:text-slate-900">{t(`challenges.empty.${tab}.title`)}</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-zinc-400 light:text-slate-500">{t(`challenges.empty.${tab}.body`)}</p>
          {tab !== "open" && (
            <Link
              href="/challenges"
              className={buttonClass({
                variant: "secondary",
                className: "mt-5",
              })}
            >
              {t("challenges.seeOpen")}
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c, i) => (
            <ChallengeCard key={c.id} challenge={c} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
