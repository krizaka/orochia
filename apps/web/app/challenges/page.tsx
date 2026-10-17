import React from "react";
import Link from "next/link";
import { UrlTabs } from "@/components/UrlTabs";
import { redirect } from "next/navigation";
import { CardGrid } from "@krizaka/ui/card-grid";
import { LinkCard } from "@krizaka/ui/link-card";
import { ChallengeAutoStart } from "@/components/challenges/ChallengeAutoStart";
import { challengeKindFromSlug, challengeStartHref, CHALLENGE_STARTS } from "@/lib/challenge-kinds";
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

const ICONS = { GOAL: Target, REQUEST: Flame, OPEN_CALL: Megaphone } as const;

/**
 * Challenges: what is taking pledges (ending soonest first), open calls creators can take, what was delivered, and —
 * signed in — the creator's inbox, what the viewer wrote and what they back. The three kinds are explained up top.
 */
export default async function ChallengesPage(props: { searchParams: Promise<{ tab?: string; new?: string }> }) {
  const { tab: asked, new: startSlug } = await props.searchParams;
  const user = await getCurrentUser();
  // A card said "start this kind": a visitor signs in and comes back here; only a creator sets a goal.
  const startKind = challengeKindFromSlug(startSlug);
  if (startKind && !user) redirect(`/auth/login?next=${encodeURIComponent(challengeStartHref(startSlug as "goal" | "dare" | "call"))}`);
  if (startKind === "GOAL" && user && user.role !== "CREATOR") redirect("/creator/apply");
  const tabs = CHALLENGE_TABS.filter((id) => (id === "inbox" ? user?.role === "CREATOR" : PERSONAL_CHALLENGE_TABS.includes(id) ? Boolean(user) : true));
  const tab: ChallengeTab = (tabs as readonly string[]).includes(asked ?? "") ? (asked as ChallengeTab) : "open";
  const items = await listChallenges(tab, user?.id ?? null);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between" data-reveal>
        <div>
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-fg-accent">
            <Flame className="h-3.5 w-3.5" /> {t("challenges.eyebrow")}
          </p>
          <h1 className="mt-2 font-display text-2xl font-black text-fg sm:text-3xl">{t("challenges.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-fg-secondary">{t("challenges.subtitle")}</p>
        </div>
        <StartChallengeButton signedIn={Boolean(user)} isCreator={user?.role === "CREATOR"} />
      </header>

      <CardGrid min={240} className="mb-8">
        {CHALLENGE_STARTS.map(({ slug, kind, messageKey }) => {
          const Icon = ICONS[kind];
          return (
            <LinkCard
              key={kind}
              href={challengeStartHref(slug)}
              linkAs={Link}
              icon={<Icon className="h-4 w-4" aria-hidden />}
              title={t(`challenge.kind.${kind}`)}
              description={t(`challenges.how.${kind}`)}
              cta={t("challenges.startCta")}
            />
          );
        })}
      </CardGrid>
      {startKind && user && <ChallengeAutoStart kind={startKind} isCreator={user.role === "CREATOR"} />}

      <UrlTabs label={t("challenges.tabsLabel")} path="/challenges" defaultId="open" active={tab} tabs={tabs.map((id) => ({ id, label: t(`challenges.tabs.${id}`) }))}>
  
        {items.length === 0 ? (
          <div className="kz-fade rounded-3xl border border-dashed border-border-default px-6 py-16 text-center">
            <Flame className="mx-auto h-8 w-8 text-fg-accent/70" aria-hidden />
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
      </UrlTabs>
    </div>
  );
}
