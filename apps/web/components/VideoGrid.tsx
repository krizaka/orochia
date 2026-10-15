"use client";

import { MediaGrid } from "@krizaka/ui/media-grid";
import React from "react";

import { VideoCard, type VideoCardProps } from "@/components/VideoCard";
import { t } from "@/lib/i18n";
import { frameOf } from "@/lib/video-aspect";

/**
 * Every list of videos of the product: the 9:16 clips on a Shorts shelf, the others in one uniform 16:9 grid (the kit's
 * `MediaGrid`, mode `split`) — a vertical card never towers over a horizontal one. `layout="list"` is one row per video.
 */
export function VideoGrid({ videos, layout = "grid", className }: { videos: VideoCardProps[]; layout?: "grid" | "list"; className?: string }) {
  return (
    <MediaGrid
      data-testid="video-grid"
      className={className}
      items={videos}
      getId={(v) => v.id}
      orientationOf={(v) => frameOf(v.width, v.height)}
      layout={layout}
      shelf={{ label: t("feed.shorts"), previousLabel: t("feed.shortsPrevious"), nextLabel: t("feed.shortsNext") }}
      renderItem={(video, { aspect, layout: cardLayout }) => <VideoCard {...video} aspect={aspect} layout={cardLayout} />}
    />
  );
}
