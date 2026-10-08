"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Users, Tv, Hash, Lock, CheckCircle2, ArrowRight, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { AVATAR_PLACEHOLDER } from "@/lib/auth-context";
import { t } from "@/lib/i18n";

interface CreatorResult {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  isVerified: boolean;
}

interface VideoResult {
  id: string;
  title: string;
  creatorName: string;
  creatorUsername: string;
  creatorAvatar: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number;
  visibility: string;
  minTipAmountCents: number;
  viewsCount: number;
}

interface TagResult {
  tag: string;
  count: number;
}

export function GlobalSearchModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "creators" | "videos" | "tags">("all");
  const [loading, setLoading] = useState(false);
  const [creators, setCreators] = useState<CreatorResult[]>([]);
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [tags, setTags] = useState<TagResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  // Handle global Cmd+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch search results
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setLoading(true);

    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          setCreators(data.creators || []);
          setVideos(data.videos || []);
          setTags(data.tags || []);
          setLoading(false);
        })
        .catch((err) => {
          if (err.name !== "AbortError") setLoading(false);
        });
    }, 120);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, isOpen]);

  if (!isOpen) return null;

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleSelect = (url: string) => {
    onClose();
    router.push(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-md p-4 pt-16 sm:pt-24 kz-overlay">
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-950 dark:bg-zinc-950 light:bg-white shadow-2xl shadow-violet-950/40 text-white dark:text-white light:text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-white/10 dark:border-white/10 light:border-black/5 px-4 py-3.5">
          <Search className="h-5 w-5 text-violet-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            aria-label={t("search.placeholder")}
            className="flex-1 bg-transparent text-sm sm:text-base outline-none placeholder:text-zinc-500 dark:placeholder:text-zinc-500 light:placeholder:text-slate-400"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-violet-400 shrink-0" />}
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label={t("search.clear")}
              className="text-zinc-400 hover:text-white p-1 rounded-lg light:hover:text-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 dark:border-white/10 light:border-black/10 px-2 py-1 text-[11px] font-mono text-zinc-400 hover:text-white dark:hover:text-white light:hover:text-black transition-colors"
          >
            {t("search.esc")}
          </button>
        </div>

        {/* Tab Filter Chips */}
        <div className="flex items-center gap-1.5 border-b border-white/5 dark:border-white/5 light:border-black/5 bg-zinc-900/40 dark:bg-zinc-900/40 light:bg-slate-50 px-4 py-2 text-xs">
          {(["all", "creators", "videos", "tags"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-3 py-1 font-semibold capitalize transition-all ${
                activeTab === tab
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-zinc-400 dark:text-zinc-400 light:text-slate-600 hover:text-white dark:hover:text-white light:hover:text-black"
              }`}
            >
              {t(`search.tabs.${tab}`)}
            </button>
          ))}
        </div>

        {/* Results Body */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-6">
          {/* Trending Suggestions from DB if empty query */}
          {!query && tags.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 dark:text-zinc-400 light:text-slate-500 uppercase tracking-wider mb-2.5">
                <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                <span>{t("search.popular")}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((entry) => (
                  <button
                    key={entry.tag}
                    onClick={() => setQuery(entry.tag)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-900/60 dark:bg-zinc-900/60 light:bg-slate-100 px-3 py-1 text-xs text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:border-violet-500 hover:text-violet-400 transition-colors"
                  >
                    <Hash className="h-3 w-3 text-violet-400" />
                    <span>{entry.tag}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">({entry.count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Creators Section */}
          {(activeTab === "all" || activeTab === "creators") && creators.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 dark:text-zinc-400 light:text-slate-500 uppercase tracking-wider mb-3">
                <Users className="h-3.5 w-3.5 text-fuchsia-400" />
                <span>{t("search.creators", { count: creators.length })}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {creators.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => handleSelect(`/@${c.username}`)}
                    className="flex w-full items-center gap-3 text-left rounded-2xl border border-white/5 dark:border-white/5 light:border-black/5 bg-zinc-900/40 dark:bg-zinc-900/40 light:bg-slate-50 p-2.5 hover:border-violet-500/50 hover:bg-white/5 light:hover:bg-black/[0.03] cursor-pointer transition-all group"
                  >
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-violet-500/40 bg-zinc-800">
                      <img
                        src={c.avatarUrl || AVATAR_PLACEHOLDER}
                        alt={c.displayName}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white dark:text-white light:text-slate-900 truncate group-hover:text-violet-400 transition-colors">
                          {c.displayName}
                        </span>
                        {c.isVerified && (
                          <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-400 font-mono">@{c.username}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Videos Section */}
          {(activeTab === "all" || activeTab === "videos") && videos.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 dark:text-zinc-400 light:text-slate-500 uppercase tracking-wider mb-3">
                <Tv className="h-3.5 w-3.5 text-violet-400" />
                <span>{t("search.videos", { count: videos.length })}</span>
              </div>
              <div className="space-y-2">
                {videos.map((v) => (
                  <button
                    type="button"
                    key={v.id}
                    onClick={() => handleSelect(`/watch/${v.id}`)}
                    className="flex w-full items-center gap-3 text-left rounded-2xl border border-white/5 dark:border-white/5 light:border-black/5 bg-zinc-900/40 dark:bg-zinc-900/40 light:bg-slate-50 p-2.5 hover:border-violet-500/50 hover:bg-white/5 light:hover:bg-black/[0.03] cursor-pointer transition-all group"
                  >
                    <div className="relative aspect-video h-14 shrink-0 overflow-hidden rounded-xl bg-zinc-800">
                      {v.thumbnailUrl ? (
                        <img
                          src={v.thumbnailUrl}
                          alt={v.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-900/40 to-zinc-900 text-violet-400">
                          <Tv className="h-5 w-5" />
                        </div>
                      )}
                      <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.2 font-mono text-[9px] text-white">
                        {formatDuration(v.durationSeconds)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold text-white dark:text-white light:text-slate-900 truncate group-hover:text-violet-400 transition-colors">
                        {v.title}
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{v.creatorName}</p>
                    </div>
                    {v.visibility === "TIPPED_UNLOCKED" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-600/20 border border-violet-500/30 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                        <Lock className="h-2.5 w-2.5" />
                        ${(v.minTipAmountCents / 100).toFixed(2)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags Section */}
          {(activeTab === "all" || activeTab === "tags") && tags.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 dark:text-zinc-400 light:text-slate-500 uppercase tracking-wider mb-2.5">
                <Hash className="h-3.5 w-3.5 text-emerald-400" />
                <span>{t("search.tags", { count: tags.length })}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((entry) => (
                  <button
                    key={entry.tag}
                    onClick={() => handleSelect(`/explore?tag=${encodeURIComponent(entry.tag)}`)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-900/60 dark:bg-zinc-900/60 light:bg-slate-100 px-3 py-1.5 text-xs text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:border-violet-500 hover:text-white transition-colors"
                  >
                    <Hash className="h-3 w-3 text-violet-400" />
                    <span>{entry.tag}</span>
                    <span className="font-mono text-[10px] text-zinc-500">{entry.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {query && !loading && creators.length === 0 && videos.length === 0 && tags.length === 0 && (
            <div className="py-8 text-center text-xs text-zinc-400">
              {t("search.empty", { query })}
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-white/5 dark:border-white/5 light:border-black/5 bg-zinc-900/60 dark:bg-zinc-900/60 light:bg-slate-50 px-4 py-2.5 text-[11px] text-zinc-500">
          <div className="flex items-center gap-3">
            <span><kbd className="rounded border border-white/10 px-1 py-0.5">↑↓</kbd> {t("search.navigate")}</span>
            <span><kbd className="rounded border border-white/10 px-1 py-0.5">↵</kbd> {t("search.select")}</span>
          </div>
          <Link
            href={`/explore?q=${encodeURIComponent(query)}`}
            onClick={onClose}
            className="text-violet-400 hover:underline inline-flex items-center gap-1"
          >
            <span>{t("search.full")}</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
