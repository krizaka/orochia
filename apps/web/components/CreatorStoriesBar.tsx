"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Hls from "hls.js";
import { ChevronLeft, ChevronRight, Heart, Plus, Trash2, X } from "lucide-react";
import { AVATAR_PLACEHOLDER, useAuth } from "@/lib/auth-context";
import { CreateStoryModal } from "@/components/CreateStoryModal";
import { t } from "@/lib/i18n";
import { Avatar, cn, IconButton, Skeleton } from "@/components/ui";

interface StoryItem {
  id: string;
  type: "image" | "video";
  url: string;
  thumbnailUrl: string | null;
  caption: string;
  durationSeconds: number;
  createdAt: string;
  viewsCount: number;
  likesCount: number;
  seen: boolean;
  liked: boolean;
}

interface StoryRing {
  creatorId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isOwn: boolean;
  allSeen: boolean;
  stories: StoryItem[];
}

const IMAGE_SECONDS = 6;

function timeAgo(iso: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return minutes < 60 ? `${minutes}m` : `${Math.round(minutes / 60)}h`;
}

/** An HLS story video (signed playlist); reports its end so the viewer moves on. */
function StoryVideo({ src, poster, onEnded, onProgress }: { src: string; poster: string | null; onEnded: () => void; onProgress: (p: number) => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let hls: Hls | null = null;
    if (video.canPlayType("application/vnd.apple.mpegurl")) video.src = src;
    else if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
    }
    void video.play().catch(() => undefined);
    return () => hls?.destroy();
  }, [src]);
  return (
    <video
      ref={ref}
      poster={poster ?? undefined}
      playsInline
      autoPlay
      muted
      onEnded={onEnded}
      onTimeUpdate={(e) => {
        const v = e.currentTarget;
        if (v.duration) onProgress((v.currentTime / v.duration) * 100);
      }}
      className="h-full w-full object-contain"
    />
  );
}

/**
 * The stories rail (Instagram-style): one ring per creator with live stories you may see — yours
 * first, then unseen, then seen — and a full-screen viewer that walks through them. Everything comes
 * from /api/stories, already filtered and signed for you; a view counts once.
 */
export function CreatorStoriesBar() {
  const { user } = useAuth();
  const [rings, setRings] = useState<StoryRing[] | null>(null);
  const [open, setOpen] = useState<{ ring: number; story: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/stories", { cache: "no-store" }).catch(() => null);
    setRings(res?.ok ? ((await res.json()) as { rings: StoryRing[] }).rings : []);
  }, []);
  useEffect(() => void load(), [load, user?.id]);

  const ring = open ? rings?.[open.ring] : null;
  const story = open && ring ? ring.stories[open.story] : null;

  const close = useCallback(() => {
    setOpen(null);
    void load();
  }, [load]);

  const next = useCallback(() => {
    if (!open || !rings) return;
    const current = rings[open.ring];
    if (open.story < current.stories.length - 1) setOpen({ ring: open.ring, story: open.story + 1 });
    else if (open.ring < rings.length - 1) setOpen({ ring: open.ring + 1, story: 0 });
    else close();
  }, [open, rings, close]);

  const previous = () => {
    if (!open || !rings) return;
    if (open.story > 0) setOpen({ ring: open.ring, story: open.story - 1 });
    else if (open.ring > 0) setOpen({ ring: open.ring - 1, story: rings[open.ring - 1].stories.length - 1 });
  };

  // A story is marked seen (and counted once) when it is shown; images advance on a timer.
  useEffect(() => {
    if (!story) return;
    setProgress(0);
    if (!story.seen) void fetch(`/api/stories/${story.id}/view`, { method: "POST" }).catch(() => undefined);
    if (story.type !== "image") return;
    const started = Date.now();
    const timer = setInterval(() => {
      const p = ((Date.now() - started) / (IMAGE_SECONDS * 1000)) * 100;
      if (p >= 100) {
        clearInterval(timer);
        next();
      } else setProgress(p);
    }, 50);
    return () => clearInterval(timer);
  }, [story, next]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") previous();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const toggleLike = async () => {
    if (!story || !user || !open) return;
    const res = await fetch(`/api/stories/${story.id}/like`, { method: story.liked ? "DELETE" : "POST" });
    if (!res.ok) return;
    const data = (await res.json()) as { liked: boolean; likesCount: number };
    setRings((rs) =>
      rs?.map((r, ri) =>
        ri !== open.ring ? r : { ...r, stories: r.stories.map((s, si) => (si === open.story ? { ...s, liked: data.liked, likesCount: data.likesCount } : s)) },
      ) ?? rs,
    );
  };

  // Two taps to delete (no browser dialog): the first arms the button.
  const [armed, setArmed] = useState(false);
  const remove = async () => {
    if (!story) return;
    if (!armed) return setArmed(true);
    setArmed(false);
    await fetch(`/api/stories/${story.id}`, { method: "DELETE" });
    close();
  };

  const isCreator = user?.role === "CREATOR" || user?.role === "ADMIN";
  if (rings !== null && rings.length === 0 && !isCreator) return null;

  return (
    <>
      <CreateStoryModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onSuccess={load} />

      <div className="relative mb-8 overflow-hidden rounded-2xl border border-border-default bg-surface-1/60 p-3 sm:p-4 backdrop-blur-xl max-w-full">
        <div className="flex items-center gap-3.5 sm:gap-5 overflow-x-auto scrollbar-none py-1 px-1 overscroll-x-contain touch-pan-x">
          {isCreator && (
            <button onClick={() => setIsCreateOpen(true)} className="flex flex-col items-center gap-1.5 shrink-0 group">
              <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border-2 border-dashed border-accent/60 bg-accent/10 transition-transform group-hover:scale-105">
                <Plus className="h-5 w-5 sm:h-6 sm:w-6 text-accent transition-transform duration-300 group-hover:rotate-90" />
              </div>
              <span className="text-[11px] font-semibold text-fg-secondary">{t("stories.add")}</span>
            </button>
          )}

          {rings === null &&
            Array.from({ length: 5 }, (_, i) => <Skeleton key={i} shape="rect" className="h-14 w-14 shrink-0 rounded-2xl sm:h-16 sm:w-16" />)}

          {rings?.map((r, index) => (
            <button key={r.creatorId} onClick={() => setOpen({ ring: index, story: Math.max(0, r.stories.findIndex((s) => !s.seen)) })} className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-hidden">
              <div className="relative p-0.5 rounded-2xl transition-transform group-hover:scale-105 active:scale-95">
                <div
                  className={cn(
                    "absolute inset-0 rounded-2xl",
                    r.allSeen ? "bg-surface-3" : "bg-linear-to-tr from-accent via-accent-2 to-accent-2 shadow-xs shadow-accent/20"
                  )}
                />
                <div className="relative h-14 w-14 sm:h-16 sm:w-16 overflow-hidden rounded-[14px] bg-surface-1 p-0.5">
                  <Avatar src={r.avatarUrl || AVATAR_PLACEHOLDER} fallback={r.displayName.charAt(0)} className="h-full w-full rounded-[12px]" />
                </div>
              </div>
              <span className="max-w-[72px] truncate text-[11px] font-medium text-fg group-hover:text-accent">
                {r.isOwn ? t("stories.yours") : r.displayName}
              </span>
            </button>
          ))}

          {rings?.length === 0 && isCreator && <p className="px-2 text-xs text-fg-muted">{t("stories.emptyCreator")}</p>}
        </div>
      </div>

      {ring && story && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-0 sm:p-6 backdrop-blur-xl kz-overlay" role="dialog" aria-modal="true" aria-label={ring.displayName}>
          <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-black sm:h-[88vh] sm:max-h-[780px] sm:max-w-md sm:rounded-3xl sm:border sm:border-white/15">
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              {story.type === "video" ? (
                <StoryVideo key={story.id} src={story.url} poster={story.thumbnailUrl} onEnded={next} onProgress={setProgress} />
              ) : (
                <img src={story.url} alt="" className="h-full w-full object-contain" />
              )}
              <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/70 via-transparent to-black/80" />
            </div>

            {/* Tap zones: left goes back, right goes on (as in every stories viewer). */}
            <button onClick={previous} className="absolute inset-y-0 left-0 z-10 w-1/3" aria-label={t("stories.previous")} />
            <button onClick={next} className="absolute inset-y-0 right-0 z-10 w-1/3" aria-label={t("stories.next")} />

            <div className="relative z-20 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <div className="mb-3 flex gap-1.5">
                {ring.stories.map((s, i) => (
                  <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
                    <div className="h-full bg-white" style={{ width: i < open!.story ? "100%" : i === open!.story ? `${progress}%` : "0%" }} />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <Link href={`/@${ring.username}`} onClick={close} className="flex items-center gap-2.5">
                  <Avatar src={ring.avatarUrl || AVATAR_PLACEHOLDER} fallback={ring.displayName.charAt(0)} className="h-9 w-9 rounded-xl border border-white/20" />
                  <div>
                    <span className="block text-xs font-bold text-white">{ring.displayName}</span>
                    <span className="font-mono text-[10px] text-zinc-300">
                      {timeAgo(story.createdAt)}
                      {ring.isOwn && ` · ${t("stories.views", { count: story.viewsCount })}`}
                    </span>
                  </div>
                </Link>
                <div className="flex items-center gap-1.5">
                  {ring.isOwn && (
                    <button
                      onClick={remove}
                      onBlur={() => setArmed(false)}
                      className={cn(
                        "flex h-8 items-center justify-center gap-1.5 rounded-full text-white transition-all",
                        armed ? "bg-danger px-3 text-xs font-semibold" : "w-8 bg-scrim hover:bg-danger/60"
                      )}
                      aria-label={armed ? t("stories.removeArmed") : t("stories.remove")}
                    >
                      <Trash2 className="h-4 w-4" />
                      {armed && t("stories.removeArmed")}
                    </button>
                  )}
                  <IconButton onClick={close} className="h-8 w-8 bg-scrim text-fg-on-media hover:bg-scrim-strong hover:text-fg-on-media" label={t("common.close")}>
                    <X className="h-4 w-4" aria-hidden />
                  </IconButton>
                </div>
              </div>
            </div>

            <div className="relative z-20 hidden items-center justify-between px-2 sm:flex">
              <IconButton onClick={previous} className="bg-black/40 text-fg-on-media hover:bg-scrim-strong hover:text-fg-on-media" label={t("stories.previous")}>
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </IconButton>
              <IconButton onClick={next} className="bg-black/40 text-fg-on-media hover:bg-scrim-strong hover:text-fg-on-media" label={t("stories.next")}>
                <ChevronRight className="h-5 w-5" aria-hidden />
              </IconButton>
            </div>

            <div className="relative z-20 space-y-3 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {story.caption && <p className="text-sm leading-relaxed text-white/95 drop-shadow-sm">{story.caption}</p>}
              <div className="flex items-center gap-2">
                {!ring.isOwn && (
                  <Link
                    href={`/@${ring.username}`}
                    onClick={close}
                    className="flex flex-1 items-center justify-center rounded-2xl bg-linear-to-r from-accent via-accent-2 to-accent-2 py-3 text-xs font-bold text-white"
                  >
                    {t("stories.seeProfile")}
                  </Link>
                )}
                {user && !ring.isOwn && (
                  <button
                    onClick={toggleLike}
                    aria-pressed={story.liked}
                    className={cn(
                      "flex h-11 items-center gap-1.5 rounded-2xl border px-3.5",
                      story.liked ? "border-danger bg-danger/20 text-danger" : "border-white/20 bg-scrim text-fg-on-media"
                    )}
                  >
                    <Heart className={cn("h-4 w-4", story.liked ? "fill-danger" : "")} />
                    <span className="font-mono text-xs">{story.likesCount}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
