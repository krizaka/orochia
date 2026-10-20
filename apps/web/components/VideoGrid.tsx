"use client";

import { MediaGrid } from "@krizaka/ui/media-grid";
import React from "react";

import { VideoCard, type VideoCardProps } from "@/components/VideoCard";
import { useI18n } from "@/lib/i18n-client";
import { frameOf } from "@/lib/video-aspect";

// The first four posters are on the first screen (a shelf of shorts shows two or three on a phone): they load at once, not
// lazily. Only the first two are also fetched at high priority, so they do not all fight for the same bandwidth.
const FIRST_ROW = 4;
const HIGH_PRIORITY = 2;

/**
 * Every list of videos of the product: the Shorts (9:16, up to the limit) on a shelf, the others — square ones cover-cropped around their centre, no grey bars — in one uniform 16:9 grid (the kit's
 * `MediaGrid`, mode `split`) — a vertical card never towers over a horizontal one. `layout="list"` is one row per video.
 */
export function VideoGrid({ videos, layout = "grid", shortsMaxSeconds, className }: { videos: VideoCardProps[]; layout?: "grid" | "list"; /** The Shorts limit (`feed` settings, lib/video-aspect.ts `formatOf`): a longer vertical clip sits in the 16:9 grid. */ shortsMaxSeconds?: number; className?: string }) {
  const { t } = useI18n();
  // The first cards are on the first screen: their posters are not lazy. Everything else is.
  const first = new Set(videos.slice(0, FIRST_ROW).map((v) => v.id));
  const high = new Set(videos.slice(0, HIGH_PRIORITY).map((v) => v.id));
  return (
    <MediaGrid
      data-testid="video-grid"
      className={className}
      items={videos}
      getId={(v) => v.id}
      orientationOf={(v) => frameOf(v.width, v.height, v.durationSeconds, shortsMaxSeconds)}
      layout={layout}
      shelf={{ label: t("feed.shorts"), previousLabel: t("feed.shortsPrevious"), nextLabel: t("feed.shortsNext") }}
      renderItem={(video, { aspect, layout: cardLayout }) => <VideoCard {...video} priority={video.priority ?? (high.has(video.id) ? "high" : first.has(video.id))} aspect={aspect} layout={cardLayout} />}
    />
  );
}
