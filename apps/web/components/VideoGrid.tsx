"use client";

import { MediaGrid } from "@krizaka/ui/media-grid";
import React from "react";

import { VideoCard, type VideoCardProps } from "@/components/VideoCard";
import { useI18n } from "@/lib/i18n-client";
import { frameOf } from "@/lib/video-aspect";

const FIRST_ROW = 4;

/**
 * Every list of videos of the product: the Shorts (9:16, up to the limit) on a shelf, the others — square ones cover-cropped around their centre, no grey bars — in one uniform 16:9 grid (the kit's
 * `MediaGrid`, mode `split`) — a vertical card never towers over a horizontal one. `layout="list"` is one row per video.
 */
export function VideoGrid({ videos, layout = "grid", shortsMaxSeconds, className }: { videos: VideoCardProps[]; layout?: "grid" | "list"; /** The Shorts limit (`feed` settings, lib/video-aspect.ts `formatOf`): a longer vertical clip sits in the 16:9 grid. */ shortsMaxSeconds?: number; className?: string }) {
  const { t } = useI18n();
  // The first row is on the first screen: its posters are not lazy. Everything below the fold is.
  const first = new Set(videos.slice(0, FIRST_ROW).map((v) => v.id));
  return (
    <MediaGrid
      data-testid="video-grid"
      className={className}
      items={videos}
      getId={(v) => v.id}
      orientationOf={(v) => frameOf(v.width, v.height, v.durationSeconds, shortsMaxSeconds)}
      layout={layout}
      shelf={{ label: t("feed.shorts"), previousLabel: t("feed.shortsPrevious"), nextLabel: t("feed.shortsNext") }}
      renderItem={(video, { aspect, layout: cardLayout }) => <VideoCard {...video} priority={video.priority ?? first.has(video.id)} aspect={aspect} layout={cardLayout} />}
    />
  );
}
