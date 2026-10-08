import React from "react";
import Link from "next/link";
import { Search, Hash, Compass } from "lucide-react";
import { VideoCard } from "@/components/VideoCard";
import { popularTags, searchVideos } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Explore creators and videos",
  description: "Search Orochia: independent creators, their videos, collections and tags.",
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
        <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-violet-300 dark:text-violet-300 light:text-violet-700">
          <Compass className="h-3.5 w-3.5" /> Explore
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-black text-white dark:text-white light:text-slate-900 font-display">
          Find your next obsession.
        </h1>
      </div>

      <form action="/explore" className="flex gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 light:text-slate-500" />
          <input
            name="q"
            defaultValue={q}
            maxLength={100}
            placeholder="Search videos and creators"
            className="w-full rounded-2xl border border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-900/80 dark:bg-zinc-900/80 light:bg-slate-100 py-3 pl-11 pr-4 text-sm text-white dark:text-white light:text-slate-900 placeholder:text-zinc-500 dark:placeholder:text-zinc-500 light:placeholder:text-slate-400 focus:border-violet-500 focus:outline-none"
          />
        </div>
        {tag && <input type="hidden" name="tag" value={tag} />}
        <button className="rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 text-xs font-bold text-white shadow-lg shadow-violet-600/20 hover:scale-105 active:scale-95 transition-all">
          Search
        </button>
      </form>

      {tags.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={href({ tag: undefined, page: undefined })}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              !tag
                ? "border-violet-500 bg-violet-600/20 text-white dark:text-white light:text-violet-900"
                : "border-white/10 dark:border-white/10 light:border-black/10 text-zinc-400 dark:text-zinc-400 light:text-slate-600 hover:text-white dark:hover:text-white light:hover:text-black"
            }`}
          >
            All
          </Link>
          {tags.map((t) => (
            <Link
              key={t.tag}
              href={href({ tag: t.tag, page: undefined })}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                tag === t.tag
                  ? "border-violet-500 bg-violet-600/20 text-white dark:text-white light:text-violet-900 font-bold"
                  : "border-white/10 dark:border-white/10 light:border-black/10 text-zinc-400 dark:text-zinc-400 light:text-slate-600 hover:text-white dark:hover:text-white light:hover:text-black"
              }`}
            >
              <Hash className="h-3 w-3" /> {t.tag}{" "}
              <span className="font-mono text-[10px] text-zinc-500 light:text-slate-500">{t.count}</span>
            </Link>
          ))}
        </div>
      )}

      {videos.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-900/40 dark:bg-zinc-900/40 light:bg-slate-50 p-12 text-center text-sm text-zinc-400 dark:text-zinc-400 light:text-slate-500">
          Nothing matches {q ? <>“{q}”</> : "this filter"} yet.
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {videos.slice(0, PAGE).map((video) => (
            <VideoCard key={video.id} {...video} />
          ))}
        </div>
      )}

      {(page > 1 || hasMore) && (
        <div className="mt-10 flex justify-center gap-3 text-xs">
          {page > 1 && (
            <Link
              href={href({ page: page - 1 })}
              className="rounded-xl border border-white/10 dark:border-white/10 light:border-black/10 px-4 py-2 text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:bg-zinc-800"
            >
              Previous
            </Link>
          )}
          {hasMore && (
            <Link
              href={href({ page: page + 1 })}
              className="rounded-xl border border-white/10 dark:border-white/10 light:border-black/10 px-4 py-2 text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:bg-zinc-800"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
