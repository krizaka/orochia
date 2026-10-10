import { AuctionIcon, ChallengeIcon, CreatorIcon, SearchIcon, StoryIcon, VideoIcon } from "@krizaka/icons";
import { Flame, Hash, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import React from "react";

import { AuctionCard } from "@/components/auctions/AuctionCard";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";
import { CreatorTile } from "@/components/explore/CreatorTile";
import { CardRail, ExploreSection, type SectionCta } from "@/components/explore/ExploreSection";
import { StoryTile } from "@/components/explore/StoryTile";
import { TagChip } from "@/components/explore/TagChip";
import { Button, buttonVariants, EmptyState, Input, SectionBackdrop } from "@/components/ui";
import { VideoCard } from "@/components/VideoCard";
import { getCurrentUser, type SessionUser } from "@/lib/auth";
import { discoverableTags, exploreResults, exploreSections, exploreTag, type ExploreVideo } from "@/lib/explore";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata = {
  title: t("explore.metaTitle"),
  description: t("explore.metaDescription"),
  alternates: { canonical: "/explore" },
};

type Params = { q?: string; tag?: string; page?: string; view?: string };

/** The address of an Explore view (only what is set; page 1 is implicit). */
function exploreHref(p: Params): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v && !(k === "page" && v === "1")) params.set(k, String(v));
  const s = params.toString();
  return s ? `/explore?${s}` : "/explore";
}

/** Where an empty section sends each kind of viewer: creators publish, members open a creator space, visitors join. */
function ctas(user: SessionUser | null) {
  const isCreator = user?.role === "CREATOR" || user?.role === "ADMIN";
  const publish: SectionCta = isCreator
    ? { href: "/creator/upload", label: t("explore.cta.publish") }
    : user
      ? { href: "/creator/upload", label: t("explore.cta.becomeCreator") }
      : { href: "/auth/register", label: t("explore.cta.join") };
  return {
    publish,
    story: isCreator && user ? { href: `/@${user.username}`, label: t("explore.cta.shareStory") } : publish,
    auction: isCreator ? { href: "/auctions?tab=selling", label: t("explore.cta.startAuction") } : { href: "/auctions", label: t("explore.cta.howAuctions") },
    challenge: { href: "/challenges", label: isCreator ? t("explore.cta.setGoal") : t("explore.cta.dare") },
  };
}

function VideoGrid({ videos, label }: { videos: ExploreVideo[]; label: string }) {
  return (
    <CardRail label={label}>
      {videos.map((video) => (
        <VideoCard key={video.id} {...video} />
      ))}
    </CardRail>
  );
}

/**
 * Explore — discovery that is never empty. Without a search: trending this week, the newest videos, live stories,
 * creators to follow, open auctions and open challenges (each with a designed empty state). With `?q=` (full-text,
 * accents ignored) and/or `?tag=` (normalised): videos, creators and stories. Public content only. The address is the
 * state: search, tag, "all videos" and the page are all in it.
 */
export default async function ExplorePage(props: { searchParams: Promise<Params> }) {
  const params = await props.searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const rawTag = (params.tag ?? "").trim();
  const tag = exploreTag(rawTag);
  const page = Math.max(1, Math.min(400, Number(params.page) || 1));
  const all = params.view === "all";
  // One address per tag: `?tag=BTS` becomes `?tag=behind-the-scenes`.
  if (rawTag && tag !== rawTag) redirect(exploreHref({ q: q || undefined, tag: tag ?? undefined, view: all ? "all" : undefined }));

  const user = await getCurrentUser();
  const searching = Boolean(q || tag || all);

  return (
    <div className="pb-16">
      <SectionBackdrop as="header" className="overflow-hidden px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
        <div className="relative mx-auto max-w-7xl">
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-fg-accent">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> {t("explore.eyebrow")}
          </p>
          <h1 className="mt-2 max-w-2xl font-display text-3xl font-black tracking-tight text-fg sm:text-5xl">{t("explore.title")}</h1>
          <p className="mt-2 max-w-xl text-sm text-fg-secondary sm:text-base">{t("explore.subtitle")}</p>

          <form action="/explore" role="search" className="mt-6 flex max-w-2xl gap-2 sm:gap-3">
            <div className="relative flex-1">
              <SearchIcon size={18} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-fg-muted" />
              <Input
                name="q"
                type="search"
                defaultValue={q}
                maxLength={100}
                placeholder={t("explore.placeholder")}
                aria-label={t("explore.placeholder")}
                className="h-12 rounded-2xl bg-surface-1/90 pl-11 pr-4 shadow-lg backdrop-blur-md"
              />
            </div>
            {tag && <input type="hidden" name="tag" value={tag} />}
            <Button type="submit" variant="sensual" size="lg" shape="rounded" className="kz-sheen rounded-2xl px-5 sm:px-6">
              {t("explore.search")}
            </Button>
          </form>

          <ExploreTags current={tag} q={q} />
        </div>
      </SectionBackdrop>

      <div className="mx-auto max-w-7xl space-y-14 px-4 pt-4 sm:px-6">
        {searching ? <Results q={q} tag={tag} page={page} all={all} user={user} /> : <Sections user={user} />}
      </div>
    </div>
  );
}

/** The popular tags, as filter chips (the current one first, with a way out). */
async function ExploreTags({ current, q }: { current: string | null; q: string }) {
  const tags = await discoverableTags(16);
  if (tags.length === 0 && !current) return null;
  const list = current && !tags.some((x) => x.tag === current) ? [{ tag: current, count: 0 }, ...tags] : tags;
  return (
    <nav aria-label={t("explore.tags")} className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
      <TagChip href={exploreHref({ q: q || undefined })} active={!current}>
        {t("explore.all")}
      </TagChip>
      {list.map((entry) => (
        <TagChip key={entry.tag} href={exploreHref({ q: q || undefined, tag: entry.tag })} active={current === entry.tag}>
          <Hash className="h-3 w-3" aria-hidden />
          {entry.tag}
          {entry.count > 0 && <span className="font-mono text-[10px] text-fg-muted">{entry.count}</span>}
        </TagChip>
      ))}
    </nav>
  );
}

/** The six discovery sections. */
async function Sections({ user }: { user: SessionUser | null }) {
  const s = await exploreSections(user);
  const cta = ctas(user);
  return (
    <>
      <ExploreSection
        id="trending"
        index={0}
        icon={<Flame className="h-4.5 w-4.5" />}
        title={t("explore.sections.trending.title")}
        description={t("explore.sections.trending.description")}
        isEmpty={s.trending.length === 0}
        empty={{ title: t("explore.sections.trending.emptyTitle"), description: t("explore.sections.trending.emptyBody"), cta: s.fresh.length ? { href: "#new", label: t("explore.cta.seeNew") } : cta.publish }}
      >
        <VideoGrid videos={s.trending} label={t("explore.sections.trending.title")} />
      </ExploreSection>

      <ExploreSection
        id="stories"
        index={1}
        icon={<StoryIcon size={18} />}
        title={t("explore.sections.stories.title")}
        description={t("explore.sections.stories.description")}
        isEmpty={s.stories.length === 0}
        empty={{ title: t("explore.sections.stories.emptyTitle"), description: t("explore.sections.stories.emptyBody"), cta: cta.story }}
      >
        <CardRail columns={6} label={t("explore.sections.stories.title")}>
          {s.stories.map((story, i) => (
            <StoryTile key={story.id} story={story} index={i} />
          ))}
        </CardRail>
      </ExploreSection>

      <ExploreSection
        id="new"
        index={2}
        icon={<VideoIcon size={18} />}
        title={t("explore.sections.new.title")}
        description={t("explore.sections.new.description")}
        seeAll={{ href: exploreHref({ view: "all" }), label: t("explore.seeAll") }}
        isEmpty={s.fresh.length === 0}
        empty={{ title: t("explore.sections.new.emptyTitle"), description: t("explore.sections.new.emptyBody"), cta: cta.publish }}
      >
        <VideoGrid videos={s.fresh} label={t("explore.sections.new.title")} />
      </ExploreSection>

      <ExploreSection
        id="creators"
        index={3}
        icon={<CreatorIcon size={18} />}
        title={t("explore.sections.creators.title")}
        description={t("explore.sections.creators.description")}
        isEmpty={s.creators.length === 0}
        empty={{ title: t("explore.sections.creators.emptyTitle"), description: t("explore.sections.creators.emptyBody"), cta: cta.publish }}
      >
        <CardRail label={t("explore.sections.creators.title")}>
          {s.creators.map((creator, i) => (
            <CreatorTile key={creator.id} creator={creator} index={i} />
          ))}
        </CardRail>
      </ExploreSection>

      <ExploreSection
        id="auctions"
        index={4}
        icon={<AuctionIcon size={18} />}
        title={t("explore.sections.auctions.title")}
        description={t("explore.sections.auctions.description")}
        seeAll={{ href: "/auctions", label: t("explore.seeAll") }}
        isEmpty={s.auctions.length === 0}
        empty={{ title: t("explore.sections.auctions.emptyTitle"), description: t("explore.sections.auctions.emptyBody"), cta: cta.auction }}
      >
        <CardRail label={t("explore.sections.auctions.title")}>
          {s.auctions.map((auction, i) => (
            <AuctionCard key={auction.id} auction={auction} index={i} />
          ))}
        </CardRail>
      </ExploreSection>

      <ExploreSection
        id="challenges"
        index={5}
        icon={<ChallengeIcon size={18} />}
        title={t("explore.sections.challenges.title")}
        description={t("explore.sections.challenges.description")}
        seeAll={{ href: "/challenges", label: t("explore.seeAll") }}
        isEmpty={s.challenges.length === 0}
        empty={{ title: t("explore.sections.challenges.emptyTitle"), description: t("explore.sections.challenges.emptyBody"), cta: cta.challenge }}
      >
        <CardRail label={t("explore.sections.challenges.title")}>
          {s.challenges.map((challenge, i) => (
            <ChallengeCard key={challenge.id} challenge={challenge} index={i} />
          ))}
        </CardRail>
      </ExploreSection>
    </>
  );
}

/** A search, a tag, or every video: creators and stories first (when they match), then the videos, paged. */
async function Results({ q, tag, page, all, user }: { q: string; tag: string | null; page: number; all: boolean; user: SessionUser | null }) {
  const r = await exploreResults(user, { q, tag, page });
  const base = { q: q || undefined, tag: tag ?? undefined, view: all && !q && !tag ? "all" : undefined };
  const heading = q && tag ? t("explore.results.both", { q, tag }) : q ? t("explore.results.query", { q }) : tag ? t("explore.results.tag", { tag }) : t("explore.results.all");
  const nothing = r.videos.length === 0 && r.creators.length === 0 && r.stories.length === 0;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-black tracking-tight text-fg sm:text-2xl">{heading}</h2>
        <Link href="/explore" className={buttonVariants({ variant: "ghost", size: "sm", shape: "rounded" })}>
          <X className="h-3.5 w-3.5" aria-hidden /> {t("explore.results.clear")}
        </Link>
      </div>

      {nothing ? (
        <EmptyState
          icon={<SearchIcon size={22} />}
          title={q ? t("explore.noMatchQuery", { q }) : t("explore.noMatchFilter")}
          description={t("explore.noMatchHint")}
          className="rounded-3xl bg-surface-1/40 py-14"
          action={
            <Link href="/explore" className={buttonVariants({ variant: "secondary", size: "sm", shape: "rounded" })}>
              {t("explore.cta.backToExplore")}
            </Link>
          }
        />
      ) : (
        <>
          {r.creators.length > 0 && page === 1 && (
            <section aria-labelledby="results-creators" className="space-y-4">
              <h3 id="results-creators" className="flex items-center gap-2 text-sm font-bold text-fg">
                <CreatorIcon size={16} className="text-accent" /> {t("explore.results.creators", { count: r.creators.length })}
              </h3>
              <CardRail label={t("explore.sections.creators.title")}>
                {r.creators.map((creator, i) => (
                  <CreatorTile key={creator.id} creator={creator} index={i} />
                ))}
              </CardRail>
            </section>
          )}

          {r.stories.length > 0 && page === 1 && (
            <section aria-labelledby="results-stories" className="space-y-4">
              <h3 id="results-stories" className="flex items-center gap-2 text-sm font-bold text-fg">
                <StoryIcon size={16} className="text-accent" /> {t("explore.results.stories", { count: r.stories.length })}
              </h3>
              <CardRail columns={6} label={t("explore.sections.stories.title")}>
                {r.stories.map((story, i) => (
                  <StoryTile key={story.id} story={story} index={i} />
                ))}
              </CardRail>
            </section>
          )}

          <section aria-labelledby="results-videos" className="space-y-4">
            <h3 id="results-videos" className="flex items-center gap-2 text-sm font-bold text-fg">
              <VideoIcon size={16} className="text-accent" /> {t("explore.results.videos")}
            </h3>
            {r.videos.length === 0 ? (
              <EmptyState icon={<VideoIcon size={22} />} title={t("explore.results.noVideos")} description={t("explore.noMatchHint")} className="rounded-3xl bg-surface-1/40 py-10" />
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {r.videos.map((video, i) => (
                  <div key={video.id} data-reveal style={{ ["--kz-delay" as string]: `${(i % 4) * 60}ms` }}>
                    <VideoCard {...video} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {(page > 1 || r.hasMore) && (
            <nav aria-label={t("explore.pages")} className="flex justify-center gap-3">
              {page > 1 && (
                <Link href={exploreHref({ ...base, page: String(page - 1) })} className={buttonVariants({ size: "md", shape: "rounded" })}>
                  {t("explore.previous")}
                </Link>
              )}
              {r.hasMore && (
                <Link href={exploreHref({ ...base, page: String(page + 1) })} className={buttonVariants({ size: "md", shape: "rounded" })}>
                  {t("explore.next")}
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </>
  );
}
