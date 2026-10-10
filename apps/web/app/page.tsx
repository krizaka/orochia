import {
  AuctionIcon,
  ChallengeIcon,
  EditIcon,
  GlobeIcon,
  HeartIcon,
  LockIcon,
  MessageIcon,
  Share90Icon,
  Story24hIcon,
  TipIcon,
  UsersIcon,
  VideoIcon,
} from "@krizaka/icons";
import { platformFeePercent } from "@orochia/payments";
import Link from "next/link";
import React from "react";

import { AuctionCard } from "@/components/auctions/AuctionCard";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";
import { FeedFilterTabs } from "@/components/FeedFilterTabs";
import { AuctionsExplainer } from "@/components/home/AuctionsExplainer";
import { BackdropMedia } from "@/components/home/BackdropMedia";
import { ChallengesExplainer } from "@/components/home/ChallengesExplainer";
import { CreatorsCallToAction } from "@/components/home/CreatorsCallToAction";
import { GetPaid } from "@/components/home/GetPaid";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeSectionHeader } from "@/components/home/HomeSectionHeader";
import { StoriesRail } from "@/components/home/StoriesRail";
import { RelationshipActions } from "@/components/RelationshipActions";
import { buttonVariants, cn, SectionBackdrop } from "@/components/ui";
import { listAuctions } from "@/lib/auctions";
import { getCurrentUser } from "@/lib/auth";
import { AVATAR_PLACEHOLDER } from "@/lib/auth-context";
import { listChallenges } from "@/lib/challenges";
import { t } from "@/lib/i18n";
import { featuredCreator, listFeed, platformStats } from "@/lib/queries";

export const metadata = { alternates: { canonical: "/" } };
export const dynamic = "force-dynamic";

/** The feature band under the hero, each with its signature icon (words: home.marquee.<id>). */
const MARQUEE = [
  ["a", Story24hIcon],
  ["b", VideoIcon],
  ["c", TipIcon],
  ["i", ChallengeIcon],
  ["d", UsersIcon],
  ["e", EditIcon],
  ["f", MessageIcon],
  ["g", Share90Icon],
  ["h", GlobeIcon],
] as const;

const WHY = [
  ["stories", Story24hIcon],
  ["access", LockIcon],
  ["support", HeartIcon],
] as const;

/**
 * Home. Visitors get the pitch, section after section, each gliding from one brand tint to the next (SectionBackdrop):
 * the hero and its phone, the four ways creators get paid and the split, why fans stay, what is up for auction and being
 * funded, the trending feed, the creators' call to action. Signed-in people get their stories, auctions, challenges and
 * feed under the same light. Everything shown is read from the database or is one of the product's own rules: an empty
 * platform shows empty states, never invented creators, auctions or figures (AGENTS.md §3.F).
 */
async function loadHome() {
  try {
    const [videos, featured, stats, auctions, challenges] = await Promise.all([listFeed(24), featuredCreator(), platformStats(), listAuctions("open", null, 3), listChallenges("open", null, 3)]);
    return { videos, featured, stats, auctions, challenges };
  } catch (error) {
    console.error("[home] feed unavailable:", error);
    return { videos: [], featured: null, stats: { videos: 0, creators: 0 }, auctions: [], challenges: [] };
  }
}

export default async function HomePage() {
  const [viewer, { videos, featured, stats, auctions, challenges }] = await Promise.all([getCurrentUser(), loadHome()]);
  const fee = platformFeePercent();
  const share = 100 - fee;
  const container = "mx-auto w-full max-w-7xl px-4 sm:px-6";

  const auctionsBlock = (
    <section aria-labelledby="home-auctions" className="mb-16">
      <HomeSectionHeader
        id="home-auctions"
        icon={<AuctionIcon size={22} nodeColor="var(--kz-accent-2)" />}
        title={t("home.auctions")}
        body={t("home.auctionsLead")}
        href="/auctions"
        linkLabel={t("home.auctionsAll")}
      />
      {auctions.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {auctions.map((a, i) => (
            <AuctionCard key={a.id} auction={a} index={i} />
          ))}
        </div>
      ) : (
        <AuctionsExplainer />
      )}
    </section>
  );

  const challengesBlock = (
    <section aria-labelledby="home-challenges">
      <HomeSectionHeader
        id="home-challenges"
        icon={<ChallengeIcon size={22} nodeColor="var(--kz-accent-2)" />}
        title={t("home.challenges.title")}
        body={t("home.challenges.lead")}
        href="/challenges"
        linkLabel={t("home.challenges.all")}
      />
      {challenges.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {challenges.map((c, i) => (
            <ChallengeCard key={c.id} challenge={c} index={i} />
          ))}
        </div>
      ) : (
        <ChallengesExplainer />
      )}
    </section>
  );

  const feedAndFeatured = (
    <div className={cn(container, "py-16")}>
      <section data-reveal aria-labelledby="home-trending" className="mb-14">
        <HomeSectionHeader id="home-trending" icon={<VideoIcon size={22} nodeColor="var(--kz-accent-2)" />} title={t("home.trending")} href="/explore" linkLabel={t("home.trendingAll")} />
        <FeedFilterTabs initialVideos={videos} />
      </section>

      {featured && (
        <section
          data-reveal
          aria-labelledby="home-featured"
          className="kz-spotlight flex flex-col items-center gap-6 overflow-hidden rounded-3xl border border-border-default bg-surface-1/70 p-6 text-center backdrop-blur-xl sm:flex-row sm:p-8 sm:text-left"
        >
          <img src={featured.avatarUrl || AVATAR_PLACEHOLDER} alt="" className="h-24 w-24 shrink-0 rounded-2xl border-2 border-accent object-cover shadow-lg" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-accent">{t("home.featured")}</p>
            <h2 id="home-featured" className="mt-1 text-xl font-bold text-fg">{featured.displayName}</h2>
            {featured.bio && <p className="mt-1 line-clamp-2 text-sm text-fg-secondary">{featured.bio}</p>}
            <p className="mt-2 font-mono text-xs text-fg-muted">
              {t("home.figures.videos", { count: featured.videosCount })} · {t("home.figures.views", { count: featured.totalViews.toLocaleString("en-US") })}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link href={`/@${featured.username}`} className={buttonVariants({ variant: "primary", size: "md", shape: "pill" })}>
              {t("home.viewProfile")}
            </Link>
            <RelationshipActions username={featured.username} show={["follow"]} />
          </div>
        </section>
      )}
    </div>
  );

  if (viewer) {
    return (
      <div className="w-full overflow-x-clip">
        <SectionBackdrop direction="down" aria-labelledby="home-welcome">
          <div className={cn(container, "pb-6 pt-8 sm:pt-12")}>
            <div data-reveal className="mb-7">
              <h1 id="home-welcome" className="font-display text-3xl font-black tracking-tight text-fg sm:text-4xl">
                {t("home.member.title", { name: viewer.username })}
              </h1>
              <p className="mt-1.5 text-sm text-fg-secondary sm:text-base">{t("home.member.body")}</p>
            </div>
            <StoriesRail />
            {auctionsBlock}
            {challengesBlock}
          </div>
        </SectionBackdrop>
        {feedAndFeatured}
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-clip">
      <HomeHero share={share} stats={stats} />

      <div aria-hidden className="relative -mt-6 overflow-hidden py-3 mask-[linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <div className="kz-marquee gap-3" style={{ ["--kz-marquee-duration" as string]: "60s" }}>
          {[0, 1].map((copy) => (
            <div key={copy} className="flex gap-3 pr-3">
              {MARQUEE.map(([k, Icon]) => (
                <span key={k} className="flex items-center gap-2 whitespace-nowrap rounded-full border border-border-default bg-surface-1/80 px-4 py-2 text-sm font-semibold text-fg-secondary backdrop-blur-md">
                  <Icon size={16} className="text-fg-accent" nodeColor="var(--kz-accent-2)" /> {t(`home.marquee.${k}`, { share })}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <GetPaid fee={fee} />

      <SectionBackdrop direction="down" dome={false} media={<BackdropMedia clips={["fans"]} />} className="orochia-depth" aria-labelledby="home-why">
        <div className={cn(container, "py-20 sm:py-24")}>
          <div data-reveal className="mb-10 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-fg-accent">{t("home.why.eyebrow")}</p>
            <h2 id="home-why" className="mt-2 font-display text-3xl font-black tracking-tight text-fg sm:text-4xl">{t("home.why.title")}</h2>
            <p className="mt-3 text-base leading-relaxed text-fg-secondary">{t("home.why.body")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {WHY.map(([key, Icon], i) => (
              <div
                key={key}
                data-reveal
                style={{ ["--kz-delay" as string]: `${i * 90}ms` }}
                className="kz-spotlight kz-lift overflow-hidden rounded-3xl border border-border-default bg-surface-1/70 p-6 backdrop-blur-xl"
              >
                <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-fg-accent">
                  <Icon size={22} nodeColor="var(--kz-accent-2)" />
                </span>
                <h3 className="text-base font-bold text-fg">{t(`home.why.${key}.title`)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-secondary">{t(`home.why.${key}.body`, { share })}</p>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <StoriesRail />
          </div>
        </div>
      </SectionBackdrop>

      <SectionBackdrop direction="up" dome={false} aria-label={t("home.market")}>
        <div className={cn(container, "py-16 sm:py-20")}>
          {auctionsBlock}
          {challengesBlock}
        </div>
      </SectionBackdrop>

      {feedAndFeatured}

      <CreatorsCallToAction share={share} />
    </div>
  );
}
