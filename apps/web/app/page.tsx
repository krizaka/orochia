import React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clapperboard, HeartHandshake, Lock, Sparkles, UserPlus } from "lucide-react";
import { platformFeePercent } from "@orochia/payments";
import { getCurrentUser } from "@/lib/auth";
import { featuredCreator, listFeed, platformStats } from "@/lib/queries";
import { AVATAR_PLACEHOLDER } from "@/lib/auth-context";
import { CreatorStoriesBar } from "@/components/CreatorStoriesBar";
import { FeedFilterTabs } from "@/components/FeedFilterTabs";
import { RelationshipActions } from "@/components/RelationshipActions";
import { HeroWall } from "@/components/home/HeroWall";
import { t } from "@/lib/i18n";

export const metadata = { alternates: { canonical: "/" } };
export const dynamic = "force-dynamic";

async function loadHome() {
  try {
    const [videos, featured, stats] = await Promise.all([listFeed(24), featuredCreator(), platformStats()]);
    return { videos, featured, stats };
  } catch (error) {
    console.error("[home] feed unavailable:", error);
    return { videos: [], featured: null, stats: { videos: 0, creators: 0 } };
  }
}

/**
 * Home. Visitors get the pitch — a moving wall of what is really on the platform, why fans stay, why
 * creators publish here — then the trending feed. Signed-in people go straight to stories and feed.
 */
export default async function HomePage() {
  const [viewer, { videos, featured, stats }] = await Promise.all([getCurrentUser(), loadHome()]);
  const share = 100 - platformFeePercent();
  const wall = videos.map((v) => v.thumbnailUrl).filter((u): u is string => Boolean(u)).slice(0, 18);
  const surface = "border border-white/10 light:border-black/5 bg-zinc-900/40 light:bg-white";

  return (
    <div className="mx-auto w-full max-w-7xl overflow-x-hidden px-3 py-4 sm:px-6 sm:py-8">
      {!viewer && (
        <section className="relative mb-10 overflow-hidden rounded-[2rem] border border-white/10 light:border-black/5 bg-zinc-950 light:bg-gradient-to-br light:from-violet-50 light:via-white light:to-pink-50 isolate">
          <HeroWall images={wall} />
          <div className="absolute inset-0 -z-0 bg-gradient-to-r from-zinc-950 via-zinc-950/85 to-transparent light:from-white light:via-white/85" />
          <div className="relative z-10 max-w-xl px-6 py-14 sm:px-12 sm:py-24">
            <p className="hero-fade inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1 text-xs font-semibold text-violet-300 light:text-violet-700">
              <Sparkles className="h-3.5 w-3.5" /> {t("home.eyebrow")}
            </p>
            <h1 className="hero-fade mt-5 font-display text-4xl font-black leading-[1.05] tracking-tight text-white light:text-slate-900 sm:text-6xl [animation-delay:80ms]">
              {t("home.title")}
              <span className="block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent light:from-violet-600 light:via-fuchsia-600 light:to-pink-600">
                {t("home.titleAccent")}
              </span>
            </h1>
            <p className="hero-fade mt-5 text-base leading-relaxed text-zinc-300 light:text-slate-600 sm:text-lg [animation-delay:160ms]">{t("home.body", { share })}</p>
            <div className="hero-fade mt-8 flex flex-col gap-3 sm:flex-row [animation-delay:240ms]">
              <Link
                href="/auth/register"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-fuchsia-600/30 transition-transform hover:scale-[1.02] active:scale-95"
              >
                <UserPlus className="h-4 w-4" /> {t("home.ctaJoin")}
              </Link>
              <Link
                href="/explore"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 light:border-black/10 bg-white/5 light:bg-white px-6 py-3.5 text-sm font-semibold text-white light:text-slate-800 backdrop-blur hover:bg-white/10"
              >
                {t("home.ctaExplore")} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <ul className="hero-fade mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-400 light:text-slate-500 [animation-delay:320ms]">
              {[t("home.trust.free"), t("home.trust.private"), t("home.trust.share", { share })].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> {item}
                </li>
              ))}
            </ul>
            {stats.videos > 0 && (
              <p className="hero-fade mt-4 font-mono text-[11px] text-zinc-500 [animation-delay:400ms]">
                {t("home.stats", { videos: stats.videos.toLocaleString("en-US"), creators: stats.creators.toLocaleString("en-US") })}
              </p>
            )}
          </div>
        </section>
      )}

      <CreatorStoriesBar />

      {!viewer && (
        <section className="mb-12">
          <h2 className="mb-5 font-display text-xl font-bold text-white light:text-slate-900">{t("home.why.title")}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ["stories", Clapperboard, "text-violet-400 bg-violet-600/15"],
                ["access", Lock, "text-fuchsia-400 bg-fuchsia-600/15"],
                ["support", HeartHandshake, "text-emerald-400 bg-emerald-600/15"],
              ] as const
            ).map(([key, Icon, tone]) => (
              <div key={key} className={`rounded-3xl p-6 ${surface}`}>
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-white light:text-slate-900">{t(`home.why.${key}.title`)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400 light:text-slate-600">{t(`home.why.${key}.body`, { share })}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-12">
        <h2 className="mb-4 font-display text-xl font-bold text-white light:text-slate-900">{t("home.trending")}</h2>
        <FeedFilterTabs initialVideos={videos} />
      </section>

      {featured && (
        <section className={`mb-12 flex flex-col items-center gap-6 rounded-3xl p-6 text-center sm:flex-row sm:p-8 sm:text-left ${surface}`}>
          <img src={featured.avatarUrl || AVATAR_PLACEHOLDER} alt="" className="h-24 w-24 shrink-0 rounded-2xl border-2 border-violet-500/60 object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-400 light:text-violet-700">{t("home.featured")}</p>
            <h3 className="mt-1 text-xl font-bold text-white light:text-slate-900">{featured.displayName}</h3>
            {featured.bio && <p className="mt-1 line-clamp-2 text-sm text-zinc-400 light:text-slate-600">{featured.bio}</p>}
            <p className="mt-2 font-mono text-xs text-zinc-500">
              {t("home.figures.videos", { count: featured.videosCount })} · {t("home.figures.views", { count: featured.totalViews.toLocaleString("en-US") })}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link href={`/creators/${featured.username}`} className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 text-xs font-bold text-white">
              {t("home.viewProfile")}
            </Link>
            <RelationshipActions username={featured.username} show={["follow"]} />
          </div>
        </section>
      )}

      {!viewer && (
        <section className="relative mb-6 overflow-hidden rounded-[2rem] border border-violet-500/20 bg-gradient-to-br from-violet-950/60 via-zinc-950 to-fuchsia-950/50 light:from-violet-100 light:via-white light:to-pink-100 p-8 sm:p-12">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-300 light:text-violet-700">{t("home.creators.eyebrow")}</p>
          <h2 className="mt-2 max-w-xl font-display text-2xl font-black text-white light:text-slate-900 sm:text-4xl">{t("home.creators.title")}</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-300 light:text-slate-600 sm:text-base">{t("home.creators.body")}</p>
          <ul className="mt-5 space-y-2 text-sm text-zinc-300 light:text-slate-700">
            {(["upload", "audience", "paid"] as const).map((i) => (
              <li key={i} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" /> {t(`home.creators.points.${i}`, { share })}
              </li>
            ))}
          </ul>
          <Link href="/auth/register" className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-bold text-zinc-950 light:bg-slate-900 light:text-white">
            {t("home.creators.cta")} <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      )}
    </div>
  );
}
