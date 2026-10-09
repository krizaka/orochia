import React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clapperboard, Flame, Gavel, HeartHandshake, Lock, Sparkles, UserPlus } from "lucide-react";
import { platformFeePercent } from "@orochia/payments";
import { getCurrentUser } from "@/lib/auth";
import { featuredCreator, listFeed, platformStats } from "@/lib/queries";
import { listAuctions } from "@/lib/auctions";
import { AuctionCard } from "@/components/auctions/AuctionCard";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";
import { listChallenges } from "@/lib/challenges";
import { AVATAR_PLACEHOLDER } from "@/lib/auth-context";
import { CreatorStoriesBar } from "@/components/CreatorStoriesBar";
import { FeedFilterTabs } from "@/components/FeedFilterTabs";
import { RelationshipActions } from "@/components/RelationshipActions";
import { HeroWall } from "@/components/home/HeroWall";
import { ProductShowcase } from "@/components/home/ProductShowcase";
import { CreatorsPreview } from "@/components/home/CreatorsPreview";
import { AuctionsExplainer } from "@/components/home/AuctionsExplainer";
import { RotatingWord } from "@/components/ui";
import { t } from "@/lib/i18n";

export const metadata = { alternates: { canonical: "/" } };
export const dynamic = "force-dynamic";

/**
 * Home. Visitors get the pitch — a moving wall of what is really on the platform, why fans stay, why
 * creators publish here — then the trending feed. Signed-in people go straight to stories and feed. Everything shown
 * is read from the database or is one of the product's own rules: an empty platform shows empty states, never
 * invented creators, auctions or figures (AGENTS.md §3.F).
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
  const share = 100 - platformFeePercent();
  const wall = videos.map((v) => v.thumbnailUrl).filter((u): u is string => Boolean(u)).slice(0, 18);
  const surface = "border border-border-default bg-surface-2/40";

  return (
    <div className="mx-auto w-full max-w-7xl overflow-x-hidden px-3 py-4 sm:px-6 sm:py-8">
      {!viewer && (
        <section className="relative mb-10 overflow-hidden rounded-4xl border border-border-default bg-zinc-950 light:bg-linear-to-br light:from-violet-50 light:via-white light:to-pink-50 isolate">
          <HeroWall images={wall} />
          <div className="absolute inset-0 z-0 bg-linear-to-r from-zinc-950 via-zinc-950/85 to-transparent light:from-white light:via-white/85" />
          <div className="relative z-10 grid grid-cols-1 items-center gap-10 px-6 py-12 sm:px-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-6 lg:py-20">
          <div className="min-w-0 max-w-xl">
            <p className="hero-fade inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1 text-xs font-semibold text-accent">
              <Sparkles className="h-3.5 w-3.5" /> {t("home.eyebrow")}
            </p>
            <h1
              aria-label={`${t("home.titleLead")} ${t("home.rotating.a")}`}
              className="hero-fade mt-5 font-display text-4xl font-black leading-[1.05] tracking-tight text-fg sm:text-6xl [animation-delay:80ms]"
            >
              <span aria-hidden>{t("home.titleLead")}</span>
              <span className="block">
                <RotatingWord
                  words={[t("home.rotating.a"), t("home.rotating.b"), t("home.rotating.c"), t("home.rotating.d")]}
                  className="kz-gradient-text bg-linear-to-r from-accent via-accent-2 to-accent-2 bg-clip-text pr-1 text-transparent"
                />
              </span>
            </h1>
            <p className="hero-fade mt-5 text-base leading-relaxed text-fg-secondary sm:text-lg [animation-delay:160ms]">{t("home.body", { share })}</p>
            <div className="hero-fade mt-8 flex flex-col gap-3 sm:flex-row [animation-delay:240ms]">
              <Link
                href="/auth/register"
                className="kz-sheen inline-flex items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-accent via-accent-2 to-accent-2 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-accent/30 transition-transform hover:scale-[1.02] active:scale-95"
              >
                <UserPlus className="h-4 w-4" /> {t("home.ctaJoin")}
              </Link>
              <Link
                href="/explore"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border-strong bg-surface-2 px-6 py-3.5 text-sm font-semibold text-fg backdrop-blur-sm hover:bg-white/10"
              >
                {t("home.ctaExplore")} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <ul className="hero-fade mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-fg-secondary [animation-delay:320ms]">
              {[t("home.trust.free"), t("home.trust.private"), t("home.trust.share", { share })].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" /> {item}
                </li>
              ))}
            </ul>
            {stats.videos > 0 && (
              <p className="hero-fade mt-4 font-mono text-[11px] text-zinc-500 [animation-delay:400ms]">
                {t("home.stats", { videos: stats.videos.toLocaleString("en-US"), creators: stats.creators.toLocaleString("en-US") })}
              </p>
            )}
          </div>
          <div className="hero-fade flex min-w-0 justify-center [animation-delay:300ms] lg:pr-6">
            <ProductShowcase share={share} />
          </div>
          </div>
        </section>
      )}

      {!viewer && (
        <div aria-hidden className="relative -mt-4 mb-10 overflow-hidden py-2 mask-[linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
          <div className="kz-marquee gap-3" style={{ ["--kz-marquee-duration" as string]: "45s" }}>
            {[0, 1].map((copy) => (
              <div key={copy} className="flex gap-3 pr-3">
                {(["a", "b", "c", "i", "d", "e", "f", "g", "h"] as const).map((k) => (
                  <span key={k} className="flex items-center gap-2 whitespace-nowrap rounded-full border border-border-default bg-surface-2 px-4 py-2 text-sm font-semibold text-fg-secondary">
                    <Sparkles className="h-3.5 w-3.5 text-accent" /> {t(`home.marquee.${k}`, { share })}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <CreatorStoriesBar />

      {!viewer && (
        <section className="mb-12">
          <h2 data-reveal className="mb-5 font-display text-xl font-bold text-fg">{t("home.why.title")}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ["stories", Clapperboard, "text-accent bg-accent/15"],
                ["access", Lock, "text-accent bg-accent/15"],
                ["support", HeartHandshake, "text-success bg-success/15"],
              ] as const
            ).map(([key, Icon, tone], i) => (
              <div key={key} data-reveal style={{ ["--kz-delay" as string]: `${i * 90}ms` }} className={`kz-spotlight kz-lift overflow-hidden rounded-3xl p-6 ${surface}`}>
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-fg">{t(`home.why.${key}.title`)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-secondary">{t(`home.why.${key}.body`, { share })}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-12" aria-labelledby="home-auctions">
        <div className="mb-4 flex items-end justify-between gap-4" data-reveal>
          <h2 id="home-auctions" className="flex items-center gap-2 font-display text-xl font-bold text-fg">
            <Gavel className="h-5 w-5 text-accent" aria-hidden /> {t("home.auctions")}
          </h2>
          <Link href="/auctions" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent">
            {t("home.auctionsAll")} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
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

      <section className="mb-12" aria-labelledby="home-challenges">
        <div className="mb-4 flex items-end justify-between gap-4" data-reveal>
          <h2 id="home-challenges" className="flex items-center gap-2 font-display text-xl font-bold text-fg">
            <Flame className="h-5 w-5 text-accent" aria-hidden /> {t("home.challenges.title")}
          </h2>
          <Link href="/challenges" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent">
            {t("home.challenges.all")} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        {challenges.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {challenges.map((c, i) => (
              <ChallengeCard key={c.id} challenge={c} index={i} />
            ))}
          </div>
        ) : (
          <div data-reveal className={`kz-spotlight flex flex-col items-start justify-between gap-4 rounded-3xl p-6 sm:flex-row sm:items-center sm:p-8 ${surface}`}>
            <div className="max-w-2xl">
              <p className="font-display text-lg font-black text-fg">{t("home.challenges.pitch")}</p>
              <p className="mt-1 text-sm text-fg-secondary">{t("home.challenges.body")}</p>
            </div>
            <Link href="/challenges" className="kz-sheen inline-flex shrink-0 items-center gap-2 rounded-2xl bg-linear-to-r from-accent via-accent-2 to-accent-2 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-accent/30">
              <Flame className="h-4 w-4" aria-hidden /> {t("home.challenges.cta")}
            </Link>
          </div>
        )}
      </section>

      <section className="mb-12" data-reveal>
        <h2 className="mb-4 font-display text-xl font-bold text-fg">{t("home.trending")}</h2>
        <FeedFilterTabs initialVideos={videos} />
      </section>

      {featured && (() => {
        const feat = featured;
        return (
          <section data-reveal className={`kz-spotlight mb-12 flex flex-col items-center gap-6 overflow-hidden rounded-3xl p-6 text-center sm:flex-row sm:p-8 sm:text-left ${surface}`}>
            <img src={feat.avatarUrl || AVATAR_PLACEHOLDER} alt="" className="h-24 w-24 shrink-0 rounded-2xl border-2 border-accent/60 object-cover shadow-xl" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">{t("home.featured")}</p>
              <h3 className="mt-1 text-xl font-bold text-fg">{feat.displayName}</h3>
              {feat.bio && <p className="mt-1 line-clamp-2 text-sm text-fg-secondary">{feat.bio}</p>}
              <p className="mt-2 font-mono text-xs text-zinc-500">
                {t("home.figures.videos", { count: feat.videosCount })} · {t("home.figures.views", { count: feat.totalViews.toLocaleString("en-US") })}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Link href={`/@${feat.username}`} className="inline-flex items-center justify-center rounded-2xl bg-linear-to-r from-accent to-accent-2 px-5 py-3 text-xs font-bold text-white shadow-lg">
                {t("home.viewProfile")}
              </Link>
              <RelationshipActions username={feat.username} show={["follow"]} />
            </div>
          </section>
        );
      })()}

      {!viewer && (
        <section data-reveal className="relative mb-6 grid items-center gap-10 overflow-hidden rounded-4xl border border-accent/20 bg-linear-to-br from-accent/20 via-zinc-950 to-accent-2/15 p-8 light:via-white sm:p-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">{t("home.creators.eyebrow")}</p>
          <h2 className="mt-2 max-w-xl font-display text-2xl font-black text-fg sm:text-4xl">{t("home.creators.title")}</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-fg-secondary sm:text-base">{t("home.creators.body")}</p>
          <ul className="mt-5 space-y-2 text-sm text-fg-secondary">
            {(["upload", "audience", "paid"] as const).map((i) => (
              <li key={i} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" /> {t(`home.creators.points.${i}`, { share })}
              </li>
            ))}
          </ul>
          <Link href="/auth/register" className="kz-sheen mt-7 inline-flex items-center gap-2 rounded-2xl bg-surface-2 px-6 py-3 text-sm font-bold text-fg-muted">
            {t("home.creators.cta")} <ArrowRight className="h-4 w-4" />
          </Link>
          </div>
          <CreatorsPreview share={share} />
        </section>
      )}
    </div>
  );
}
