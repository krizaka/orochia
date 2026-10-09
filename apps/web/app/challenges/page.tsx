import React from "react";
import Link from "next/link";
import { Flame, Megaphone, Target } from "lucide-react";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";
import { StartChallengeButton } from "@/components/challenges/StartChallengeButton";
import { buttonVariants, cn } from "@/components/ui";
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
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-accent">
            <Flame className="h-3.5 w-3.5" /> {t("challenges.eyebrow")}
          </p>
          <h1 className="mt-2 font-display text-2xl font-black text-fg sm:text-3xl">{t("challenges.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-fg-secondary">{t("challenges.subtitle")}</p>
        </div>
        <StartChallengeButton signedIn={Boolean(user)} isCreator={user?.role === "CREATOR"} />
      </header>

      <ol className="mb-8 grid gap-3 sm:grid-cols-3">
        {KINDS.map(({ kind, icon: Icon }, i) => (
          <li
            key={kind}
            data-reveal
            style={{ "--kz-delay": `${i * 80}ms` } as React.CSSProperties}
            className="kz-spotlight rounded-2xl border border-border-default bg-surface-2 p-4"
          >
            <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-accent to-accent-2 text-white shadow-lg shadow-accent/20">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <p className="text-sm font-bold text-fg">{t(`challenge.kind.${kind}`)}</p>
            <p className="mt-1 text-xs leading-relaxed text-fg-secondary">{t(`challenges.how.${kind}`)}</p>
          </li>
        ))}
      </ol>

      <nav aria-label={t("challenges.tabsLabel")} className="mb-6 flex gap-1 overflow-x-auto border-b border-border-default">
        {tabs.map((id) => (
          <Link
            key={id}
            href={id === "open" ? "/challenges" : `/challenges?tab=${id}`}
            aria-current={tab === id ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
              tab === id
                ? "border-accent text-fg"
                : "border-transparent text-fg-secondary hover:text-fg",
            )}
          >
            {t(`challenges.tabs.${id}`)}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <div className="kz-fade rounded-3xl border border-dashed border-border-default px-6 py-16 text-center">
          <Flame className="mx-auto h-8 w-8 text-accent/70" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-fg">{t(`challenges.empty.${tab}.title`)}</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-fg-secondary">{t(`challenges.empty.${tab}.body`)}</p>
          {tab !== "open" && (
            <Link
              href="/challenges"
              className={buttonVariants({ variant: "secondary", shape: "pill", className: "mt-5" })}
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
