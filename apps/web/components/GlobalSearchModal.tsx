"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Users, Tv, Hash, Lock, CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui";
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-scrim-strong backdrop-blur-md p-4 pt-16 sm:pt-24 kz-overlay">
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-border-default bg-surface-1 shadow-2xl shadow-accent/40 text-fg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-border-default px-4 py-3.5">
          <Search className="h-5 w-5 text-accent shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            aria-label={t("search.placeholder")}
            className="flex-1 bg-transparent text-sm sm:text-base outline-hidden placeholder:text-fg-muted"
          />
          {loading && <Spinner size="sm" className="shrink-0" />}
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label={t("search.clear")}
              className="text-fg-secondary hover:text-fg p-1 rounded-lg"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-xl border border-border-default px-2 py-1 text-[11px] font-mono text-fg-secondary hover:text-fg transition-colors"
          >
            {t("search.esc")}
          </button>
        </div>

        {/* Tab Filter Chips */}
        <div className="flex items-center gap-1.5 border-b border-border-subtle bg-surface-2/40 px-4 py-2 text-xs">
          {(["all", "creators", "videos", "tags"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-3 py-1 font-semibold capitalize transition-all ${
                activeTab === tab
                  ? "bg-accent text-white shadow-xs"
                  : "text-fg-secondary hover:text-fg"
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
              <div className="flex items-center gap-2 text-xs font-semibold text-fg-secondary uppercase tracking-wider mb-2.5">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                <span>{t("search.popular")}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((entry) => (
                  <button
                    key={entry.tag}
                    onClick={() => setQuery(entry.tag)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface-2/60 px-3 py-1 text-xs text-fg-secondary hover:border-accent hover:text-accent transition-colors"
                  >
                    <Hash className="h-3 w-3 text-accent" />
                    <span>{entry.tag}</span>
                    <span className="text-[10px] text-fg-muted font-mono">({entry.count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Creators Section */}
          {(activeTab === "all" || activeTab === "creators") && creators.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-fg-secondary uppercase tracking-wider mb-3">
                <Users className="h-3.5 w-3.5 text-accent" />
                <span>{t("search.creators", { count: creators.length })}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {creators.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => handleSelect(`/@${c.username}`)}
                    className="flex w-full items-center gap-3 text-left rounded-2xl border border-border-subtle bg-surface-2/40 p-2.5 hover:border-accent/50 hover:bg-surface-2 cursor-pointer transition-all group"
                  >
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-accent/40 bg-zinc-800">
                      <img
                        src={c.avatarUrl || AVATAR_PLACEHOLDER}
                        alt={c.displayName}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-fg truncate group-hover:text-accent transition-colors">
                          {c.displayName}
                        </span>
                        {c.isVerified && (
                          <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                        )}
                      </div>
                      <span className="text-[11px] text-fg-secondary font-mono">@{c.username}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-fg-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Videos Section */}
          {(activeTab === "all" || activeTab === "videos") && videos.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-fg-secondary uppercase tracking-wider mb-3">
                <Tv className="h-3.5 w-3.5 text-accent" />
                <span>{t("search.videos", { count: videos.length })}</span>
              </div>
              <div className="space-y-2">
                {videos.map((v) => (
                  <button
                    type="button"
                    key={v.id}
                    onClick={() => handleSelect(`/watch/${v.id}`)}
                    className="flex w-full items-center gap-3 text-left rounded-2xl border border-border-subtle bg-surface-2/40 p-2.5 hover:border-accent/50 hover:bg-surface-2 cursor-pointer transition-all group"
                  >
                    <div className="relative aspect-video h-14 shrink-0 overflow-hidden rounded-xl bg-zinc-800">
                      {v.thumbnailUrl ? (
                        <img
                          src={v.thumbnailUrl}
                          alt={v.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-accent/15 to-zinc-900 text-accent">
                          <Tv className="h-5 w-5" />
                        </div>
                      )}
                      <span className="absolute bottom-1 right-1 rounded-sm bg-scrim-strong px-1 py-0.2 font-mono text-[9px] text-fg-on-media">
                        {formatDuration(v.durationSeconds)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold text-fg truncate group-hover:text-accent transition-colors">
                        {v.title}
                      </h4>
                      <p className="text-[11px] text-fg-secondary mt-0.5">{v.creatorName}</p>
                    </div>
                    {v.visibility === "TIPPED_UNLOCKED" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 border border-accent/30 px-2 py-0.5 text-[10px] font-bold text-accent">
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
              <div className="flex items-center gap-2 text-xs font-semibold text-fg-secondary uppercase tracking-wider mb-2.5">
                <Hash className="h-3.5 w-3.5 text-success" />
                <span>{t("search.tags", { count: tags.length })}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((entry) => (
                  <button
                    key={entry.tag}
                    onClick={() => handleSelect(`/explore?tag=${encodeURIComponent(entry.tag)}`)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface-2/60 px-3 py-1.5 text-xs text-fg-secondary hover:border-accent hover:text-white transition-colors"
                  >
                    <Hash className="h-3 w-3 text-accent" />
                    <span>{entry.tag}</span>
                    <span className="font-mono text-[10px] text-fg-muted">{entry.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {query && !loading && creators.length === 0 && videos.length === 0 && tags.length === 0 && (
            <div className="py-8 text-center text-xs text-fg-secondary">
              {t("search.empty", { query })}
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-border-subtle bg-surface-2/60 px-4 py-2.5 text-[11px] text-fg-muted">
          <div className="flex items-center gap-3">
            <span><kbd className="rounded-sm border border-white/10 px-1 py-0.5">↑↓</kbd> {t("search.navigate")}</span>
            <span><kbd className="rounded-sm border border-white/10 px-1 py-0.5">↵</kbd> {t("search.select")}</span>
          </div>
          <Link
            href={`/explore?q=${encodeURIComponent(query)}`}
            onClick={onClose}
            className="text-accent hover:underline inline-flex items-center gap-1"
          >
            <span>{t("search.full")}</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
