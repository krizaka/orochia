"use client";

import React, { useState } from "react";

import { Button, Chip, cn, Dialog, Sheet, Skeleton, Slider } from "@/components/ui";
import { SEGMENT_MAX_SECONDS, SEGMENT_MIN_SECONDS } from "@/lib/banner";
import { t } from "@/lib/i18n";

export interface CoverVideo {
  id: string;
  title: string;
  durationSeconds: number;
  thumbnailUrl: string | null;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const LENGTHS = Array.from({ length: SEGMENT_MAX_SECONDS - SEGMENT_MIN_SECONDS + 1 }, (_, i) => SEGMENT_MIN_SECONDS + i);

/**
 * « Use a moment of my video »: pick one of your own published videos, where the moment starts and how long it lasts
 * (3 to 6 s). Nothing is uploaded: the cover plays that part of the video you already published.
 */
export function BannerMomentDialog({
  open,
  onOpenChange,
  videos,
  loading,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videos: CoverVideo[];
  loading: boolean;
  onPick: (choice: { videoId: string; startSeconds: number; endSeconds: number; poster: string | null }) => void;
}) {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [start, setStart] = useState(0);
  const [length, setLength] = useState(4);
  const video = videos.find((v) => v.id === videoId) ?? null;
  const maxStart = video ? Math.max(0, Math.floor(video.durationSeconds - length)) : 0;
  const from = Math.min(start, maxStart);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Sheet size="lg" aria-describedby={undefined}>
        <Dialog.Header>
          <Dialog.Title>{t("movingCover.title")}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <p className="mb-3 text-sm text-fg-muted">{t("movingCover.hint", { min: SEGMENT_MIN_SECONDS, max: SEGMENT_MAX_SECONDS })}</p>
          <div className="grid max-h-[40vh] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3" aria-busy={loading}>
            {loading ? (
              Array.from({ length: 6 }, (_, i) => <Skeleton key={i} shape="rect" className="aspect-video h-auto rounded-xl" />)
            ) : videos.length === 0 ? (
              <p className="col-span-full text-sm text-fg-muted">{t("movingCover.none")}</p>
            ) : (
              videos.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={v.id === videoId}
                  onClick={() => setVideoId(v.id)}
                  className={cn("overflow-hidden rounded-xl text-left ring-2 transition-all hover:ring-ring focus-visible:outline-hidden focus-visible:ring-ring", v.id === videoId ? "ring-ring" : "ring-transparent")}
                >
                  {v.thumbnailUrl ? <img src={v.thumbnailUrl} alt="" loading="lazy" className="aspect-video w-full bg-surface-3 object-cover" /> : <div className="aspect-video w-full bg-surface-3" />}
                  <span className="block truncate px-2 py-1.5 text-xs text-fg">{v.title}</span>
                </button>
              ))
            )}
          </div>
          {video && (
            <div className="mt-4 space-y-4">
              <Chip.Group type="single" required size="sm" label={t("movingCover.length")} value={String(length)} onValueChange={(l) => setLength(Number(l))}>
                {LENGTHS.map((l) => (
                  <Chip key={l} value={String(l)}>
                    {t("movingCover.seconds", { count: l })}
                  </Chip>
                ))}
              </Chip.Group>
              <Slider
                label={t("movingCover.start")}
                showLabel
                value={from}
                min={0}
                max={Math.max(1, maxStart)}
                step={1}
                formatValue={(v) => `${clock(v)} – ${clock(v + length)}`}
                onValueChange={setStart}
              />
              <Button
                variant="primary"
                onClick={() => {
                  onOpenChange(false);
                  onPick({ videoId: video.id, startSeconds: from, endSeconds: from + length, poster: video.thumbnailUrl });
                }}
              >
                {t("movingCover.use")}
              </Button>
            </div>
          )}
        </Dialog.Body>
      </Sheet>
    </Dialog.Root>
  );
}
