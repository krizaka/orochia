"use client";

import { ShortFeed, VerticalVideo, type VerticalVideoLabels } from "@krizaka/ui/vertical-video";
import { Maximize2, Sparkles, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useRef, useState } from "react";

import { TipModal } from "@/components/TipModal";
import type { VideoCardProps } from "@/components/VideoCard";
import { cn, IconButton } from "@/components/ui";
import { mayStream } from "@/lib/feed-view";
import { t } from "@/lib/i18n";
import { frameOf } from "@/lib/video-aspect";

const matches = (query: string) => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
const saveData = () => typeof navigator !== "undefined" && (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

const RAIL_BUTTON = "h-11 min-h-11 w-11 min-w-11 bg-scrim text-fg-on-media backdrop-blur-md hover:bg-scrim";

/**
 * The phone's feed: one video per screen, snap-scrolling (@krizaka/ui `ShortFeed` / `VerticalVideo`). The video in view plays
 * muted — the sound button unmutes the whole feed — and the next one is warmed. A 9:16 clip fills the screen; a 16:9 one sits
 * whole, centred over a blurred copy of its own poster, with a way to the watch page for full screen. Nothing is requested
 * under Save-Data (posters only); the kit stills the video under reduced motion. The stream comes from the same access
 * decision as the watch page (`/api/videos/:id/stream`), which also records the view for the recommender.
 */
export function VerticalFeed({ videos, onNearEnd, className }: { videos: VideoCardProps[]; /** The viewer is within three slides of the last one: ask for the next page. */ onNearEnd?: () => void; className?: string }) {
  const router = useRouter();
  const [sound, setSound] = useState(false);
  const [streams, setStreams] = useState<Record<string, string>>({});
  const [likes, setLikes] = useState<Record<string, boolean>>({});
  const [tipping, setTipping] = useState<VideoCardProps | null>(null);
  const requested = useRef(new Set<string>());
  const allowed = typeof window !== "undefined" && mayStream({ saveData: saveData(), reducedMotion: matches("(prefers-reduced-motion: reduce)") });

  /** Asks for a slide's stream the first time it is in view or next. A refused or failed answer leaves the poster. */
  const warm = (video: VideoCardProps) => {
    if (!allowed || requested.current.has(video.id)) return;
    requested.current.add(video.id);
    void fetch(`/api/videos/${video.id}/stream`, { headers: { Accept: "application/json" } })
      .then((res) => (res.ok ? (res.json() as Promise<{ feedMp4Url?: string }>) : null))
      .then((body) => body?.feedMp4Url && setStreams((s) => ({ ...s, [video.id]: body.feedMp4Url! })))
      .catch(() => undefined);
  };

  const like = async (video: VideoCardProps, liked: boolean) => {
    setLikes((l) => ({ ...l, [video.id]: liked }));
    const res = await fetch(`/api/videos/${video.id}/like`, { method: liked ? "POST" : "DELETE" }).catch(() => null);
    if (res?.status === 401 || res?.status === 403) {
      setLikes((l) => ({ ...l, [video.id]: !liked }));
      router.push(`/auth/login?next=${encodeURIComponent("/")}`);
    } else if (!res?.ok) setLikes((l) => ({ ...l, [video.id]: !liked }));
  };

  const share = async (video: VideoCardProps) => {
    const url = `${window.location.origin}/watch/${video.id}`;
    if (navigator.share) await navigator.share({ title: video.title, url }).catch(() => undefined);
    else await navigator.clipboard?.writeText(url).catch(() => undefined);
  };

  const labels: Partial<VerticalVideoLabels> = { like: t("feed.vertical.like"), comment: t("feed.vertical.comment"), share: t("feed.vertical.share") };

  return (
    <>
      <ShortFeed
        label={t("feed.vertical.label")}
        items={videos}
        onActiveChange={(index) => index >= videos.length - 3 && onNearEnd?.()}
        getId={(v) => v.id}
        className={cn("h-[calc(100dvh-9rem)] rounded-2xl", className)}
        renderItem={(video, { active, preload }) => {
          const landscape = frameOf(video.width, video.height) === "landscape";
          const liked = likes[video.id] ?? false;
          return (
            <div
              ref={(el) => {
                if (el && (active || preload === "auto")) warm(video);
              }}
              className="relative h-full w-full"
              data-frame={landscape ? "landscape" : "portrait"}
            >
              {landscape && video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-2xl" />}
              <VerticalVideo
                fit="fill"
                title={video.title}
                src={streams[video.id]}
                poster={video.thumbnailUrl ?? undefined}
                active={active}
                preload={preload}
                muted={!sound}
                creator={{ name: video.creatorName, avatarSrc: video.creatorAvatar ?? undefined }}
                caption={video.title}
                tags={video.tags?.slice(0, 3)}
                likes={(video.likesCount ?? 0) + (liked ? 1 : 0)}
                liked={liked}
                onLike={(next) => void like(video, next)}
                onComment={() => router.push(`/watch/${video.id}#comments`)}
                onShare={() => void share(video)}
                labels={labels}
                tipSlot={
                  <IconButton label={t("feed.vertical.tip")} variant="ghost" shape="pill" onClick={() => setTipping(video)} className={RAIL_BUTTON}>
                    <Sparkles className="h-5 w-5" aria-hidden />
                  </IconButton>
                }
                topStart={
                  <div className="flex items-center gap-2">
                    <IconButton label={sound ? t("feed.vertical.mute") : t("feed.vertical.sound")} aria-pressed={sound} variant="ghost" shape="pill" onClick={() => setSound((s) => !s)} className={RAIL_BUTTON}>
                      {sound ? <Volume2 className="h-5 w-5" aria-hidden /> : <VolumeX className="h-5 w-5" aria-hidden />}
                    </IconButton>
                    {landscape && (
                      <Link href={`/watch/${video.id}`} className={cn(RAIL_BUTTON, "inline-flex items-center justify-center rounded-full")} aria-label={t("feed.vertical.fullscreen")}>
                        <Maximize2 className="h-5 w-5" aria-hidden />
                      </Link>
                    )}
                  </div>
                }
                className={cn("bg-transparent", landscape && "[&_video]:object-contain")}
              />
            </div>
          );
        }}
      />
      {tipping && <TipModal isOpen onClose={() => setTipping(null)} videoId={tipping.id} creatorName={tipping.creatorName} minTipAmountCents={tipping.minTipAmountCents} onUnlockedSuccess={() => setTipping(null)} />}
    </>
  );
}
