import React from "react";
import Link from "next/link";
import { Search, Hash, Compass, Flame, Gavel } from "lucide-react";
import { VideoCard } from "@/components/VideoCard";
import { popularTags, searchVideos } from "@/lib/queries";
import { Button, buttonVariants, Input, cn } from "@/components/ui";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata = {
  title: t("explore.metaTitle"),
  description: t("explore.metaDescription"),
  alternates: { canonical: "/explore" },
};

const PAGE = 24;

/** Explore: search titles, descriptions and creators, filter by tag, page through results. */
export default async function ExplorePage(props: { searchParams: Promise<{ q?: string; tag?: string; page?: string }> }) {
  const searchParams = await props.searchParams;
  const q = (searchParams.q ?? "").slice(0, 100);
  const tag = (searchParams.tag ?? "").slice(0, 40);
  const page = Math.max(1, Math.min(400, Number(searchParams.page) || 1));
  const [videos, tags] = await Promise.all([searchVideos({ q, tag, limit: PAGE + 1, offset: (page - 1) * PAGE }), popularTags(20)]);
  const hasMore = videos.length > PAGE;
  const href = (p: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const next = { q, tag, ...p };
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, String(v));
    const s = params.toString();
    return s ? `/explore?${s}` : "/explore";
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-accent">
          <Compass className="h-3.5 w-3.5" /> {t("explore.eyebrow")}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-black text-fg font-display">
            {t("explore.title")}
          </h1>
          <div className="flex gap-2">
            <Link href="/auctions" className={buttonVariants({ size: "sm", shape: "rounded" })}>
              <Gavel className="h-4 w-4 text-accent" aria-hidden /> {t("explore.auctions")}
            </Link>
            <Link href="/challenges" className={buttonVariants({ size: "sm", shape: "rounded" })}>
              <Flame className="h-4 w-4 text-accent" aria-hidden /> {t("explore.challenges")}
            </Link>
          </div>
        </div>
      </div>

      <form action="/explore" className="flex gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" aria-hidden />
          <Input
            name="q"
            defaultValue={q}
            maxLength={100}
            placeholder={t("explore.placeholder")}
            aria-label={t("explore.placeholder")}
            className="h-12 rounded-2xl bg-surface-2/80 pl-11 pr-4"
          />
        </div>
        {tag && <input type="hidden" name="tag" value={tag} />}
        <Button type="submit" variant="sensual" size="lg" shape="rounded" className="rounded-2xl px-6">{t("explore.search")}</Button>
      </form>

      {tags.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={href({ tag: undefined, page: undefined })}
            className={cn("rounded-full border px-3 py-1.5 text-xs transition-colors", !tag
              ? "border-accent bg-accent/20 text-fg"
              : "border-border-default text-fg-secondary hover:text-fg")}
          >
            {t("explore.all")}
          </Link>
          {tags.map((entry) => (
            <Link
              key={entry.tag}
              href={href({ tag: entry.tag, page: undefined })}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition-colors",
                tag === entry.tag
                  ? "border-accent bg-accent/20 text-fg font-bold"
                  : "border-border-default text-fg-secondary hover:text-fg"
              )}
            >
              <Hash className="h-3 w-3" /> {entry.tag}{" "}
              <span className="font-mono text-[10px] text-fg-muted">{entry.count}</span>
            </Link>
          ))}
        </div>
      )}

      {videos.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-border-default bg-surface-2/40 p-12 text-center">
          <p className="text-sm font-semibold text-fg">{q ? t("explore.noMatchQuery", { q }) : t("explore.noMatchFilter")}</p>
          <p className="mt-1 text-xs text-fg-secondary">{t("explore.noMatchHint")}</p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {videos.slice(0, PAGE).map((video, i) => (
            <div key={video.id} data-reveal style={{ ["--kz-delay" as string]: `${(i % 4) * 70}ms` }}>
              <VideoCard {...video} />
            </div>
          ))}
        </div>
      )}

      {(page > 1 || hasMore) && (
        <div className="mt-10 flex justify-center gap-3 text-xs">
          {page > 1 && (
            <Link
              href={href({ page: page - 1 })}
              className={buttonVariants({ size: "md", shape: "rounded" })}
            >
              {t("explore.previous")}
            </Link>
          )}
          {hasMore && (
            <Link
              href={href({ page: page + 1 })}
              className={buttonVariants({ size: "md", shape: "rounded" })}
            >
              {t("explore.next")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
