"use client";

import { ArrowRight, CheckCircle2, Hash, Lock, Search, Sparkles,Tv, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

import { Avatar, Badge, Chip, Command, CommandDialog, IconButton, Kbd, Spinner } from "@/components/ui";
import { AVATAR_PLACEHOLDER } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { money } from "@/lib/money";

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
  /** The 18+ veil: no picture in the palette. */
  isBlurred?: boolean;
}

interface StoryResult {
  id: string;
  creatorUsername: string;
  creatorName: string;
  posterUrl: string | null;
  caption: string;
  isBlurred: boolean;
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
  const [stories, setStories] = useState<StoryResult[]>([]);

  // A new search each time it opens.
  useEffect(() => {
    if (!isOpen) setQuery("");
  }, [isOpen]);

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
          setStories(data.stories || []);
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

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleSelect = (url: string) => {
    onClose();
    router.push(url);
  };

  const show = (tab: "creators" | "videos" | "tags") => activeTab === "all" || activeTab === tab;
  const heading = (Icon: typeof Users, text: string) => (
    <span className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-accent" aria-hidden />
      {text}
    </span>
  );

  // The palette is cmdk on @krizaka/ui's CommandDialog: the arrows move through every result, Enter opens it. The
  // server searches (debounced above), so cmdk's own filtering is off.
  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      label={t("search.title")}
      shouldFilter={false}
      contentProps={{ className: "max-w-2xl rounded-3xl shadow-2xl shadow-accent/30 sm:max-w-2xl" }}
      footer={
        <div className="flex items-center justify-between border-t border-border-subtle bg-surface-2/60 px-4 py-2.5 text-[11px] text-fg-secondary">
          <div className="flex items-center gap-3">
            <span>
              <Kbd size="sm">↑↓</Kbd> {t("search.navigate")}
            </span>
            <span>
              <Kbd size="sm">↵</Kbd> {t("search.select")}
            </span>
          </div>
          <Link href={`/explore?q=${encodeURIComponent(query)}`} onClick={onClose} className="inline-flex items-center gap-1 text-accent hover:underline">
            <span>{t("search.full")}</span>
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      }
    >
      <Command.Input
        value={query}
        onValueChange={setQuery}
        placeholder={t("search.placeholder")}
        trailing={
          <>
            {loading && <Spinner size="sm" className="shrink-0" />}
            {query && (
              <IconButton onClick={() => setQuery("")} variant="ghost" shape="rounded" className="h-7 w-7" label={t("search.clear")}>
                <X className="h-4 w-4" aria-hidden />
              </IconButton>
            )}
          </>
        }
      />

      {/* What to show: a filter of the results */}
      <Chip.Group
        type="single"
        required
        size="sm"
        label={t("search.filter")}
        value={activeTab}
        onValueChange={(tab) => setActiveTab(tab as typeof activeTab)}
        className="border-b border-border-subtle bg-surface-2/40 px-4 py-2"
      >
        {(["all", "creators", "videos", "tags"] as const).map((tab) => (
          <Chip key={tab} value={tab}>
            {t(`search.tabs.${tab}`)}
          </Chip>
        ))}
      </Chip.Group>

      <Command.List label={t("search.results")} className="max-h-[60vh]">
        {query && !loading && <Command.Empty emptyLabel={t("search.empty", { query })} />}

        {/* Popular tags while nothing is typed: picking one searches it */}
        {!query && tags.length > 0 && (
          <Command.Group heading={heading(Sparkles, t("search.popular"))}>
            {tags.map((entry) => (
              <Command.Item key={`popular-${entry.tag}`} value={`popular-${entry.tag}`} onSelect={() => setQuery(entry.tag)}>
                <Hash className="h-3.5 w-3.5 text-accent" aria-hidden />
                <span className="flex-1">{entry.tag}</span>
                <span className="font-mono text-[11px] text-fg-secondary">{entry.count}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {show("creators") && creators.length > 0 && (
          <Command.Group heading={heading(Users, t("search.creators", { count: creators.length }))}>
            {creators.map((c) => (
              <Command.Item key={c.id} value={`creator-${c.id}`} onSelect={() => handleSelect(`/@${c.username}`)} className="group">
                <Avatar src={c.avatarUrl || AVATAR_PLACEHOLDER} alt={c.displayName} fallback={c.displayName.charAt(0)} className="h-10 w-10 rounded-xl border border-accent/40" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-bold text-fg">{c.displayName}</span>
                    {c.isVerified && <CheckCircle2 className="h-3 w-3 shrink-0 text-success" aria-hidden />}
                  </span>
                  <span className="block font-mono text-[11px] text-fg-secondary">@{c.username}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-fg-muted opacity-0 transition-opacity group-data-[selected=true]:opacity-100" aria-hidden />
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {show("videos") && videos.length > 0 && (
          <Command.Group heading={heading(Tv, t("search.videos", { count: videos.length }))}>
            {videos.map((v) => (
              <Command.Item key={v.id} value={`video-${v.id}`} onSelect={() => handleSelect(`/watch/${v.id}`)}>
                <span className="relative aspect-video h-14 shrink-0 overflow-hidden rounded-xl bg-media">
                  {v.thumbnailUrl && !v.isBlurred ? (
                    <img src={v.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-linear-to-br from-accent/15 to-media text-accent">
                      <Tv className="h-5 w-5" aria-hidden />
                    </span>
                  )}
                  <span className="absolute bottom-1 right-1 rounded-sm bg-scrim-strong px-1 font-mono text-[9px] text-fg-on-media">{formatDuration(v.durationSeconds)}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-fg">{v.title}</span>
                  <span className="mt-0.5 block text-[11px] text-fg-secondary">{v.creatorName}</span>
                </span>
                {v.visibility === "TIPPED_UNLOCKED" && (
                  <Badge size="sm" tone="accent" className="font-bold normal-case tracking-normal">
                    <Lock className="h-2.5 w-2.5" aria-hidden />
                    {money(v.minTipAmountCents)}
                  </Badge>
                )}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {activeTab === "all" && stories.length > 0 && (
          <Command.Group heading={heading(Sparkles, t("search.stories", { count: stories.length }))}>
            {stories.map((s) => (
              <Command.Item key={s.id} value={`story-${s.id}`} onSelect={() => handleSelect(`/@${s.creatorUsername}?story=${s.id}`)}>
                <span className="relative h-12 w-9 shrink-0 overflow-hidden rounded-lg bg-media">
                  {s.posterUrl && !s.isBlurred && <img src={s.posterUrl} alt="" className="h-full w-full object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-fg">{s.caption || s.creatorName}</span>
                  <span className="mt-0.5 block text-[11px] text-fg-secondary">@{s.creatorUsername}</span>
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {show("tags") && tags.length > 0 && (
          <Command.Group heading={heading(Hash, t("search.tags", { count: tags.length }))}>
            {tags.map((entry) => (
              <Command.Item key={entry.tag} value={`tag-${entry.tag}`} onSelect={() => handleSelect(`/explore?tag=${encodeURIComponent(entry.tag)}`)}>
                <Hash className="h-3.5 w-3.5 text-accent" aria-hidden />
                <span className="flex-1">{entry.tag}</span>
                <span className="font-mono text-[11px] text-fg-secondary">{entry.count}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </CommandDialog>
  );
}
