import React from "react";

import { cn } from "@/components/ui";
import type { Locale } from "@/lib/locales";
import { type TourClip, tourRecording } from "@/lib/site-media";

/**
 * One real recording of the application in a window frame: the poster paints first, the clip is fetched only when
 * played (`preload="none"`), muted controls, no autoplay — so reduced motion and slow phones get the same page.
 */
export function Clip({ clip, locale, label, frameLabel, className }: { clip: TourClip; locale: Locale; label: string; frameLabel: string; className?: string }) {
  const media = tourRecording(clip, locale);
  return (
    <div className={cn("overflow-hidden rounded-3xl border border-border-default bg-surface-1/70 shadow-lg", className)}>
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2 font-mono text-[11px] text-fg-muted">
        <span aria-hidden className="h-2 w-2 rounded-full bg-accent" /> {frameLabel}
      </div>
      <video controls playsInline muted preload="none" poster={media.poster} aria-label={label} className="aspect-video w-full bg-surface-0">
        <source src={media.webm} type="video/webm" />
        <source src={media.mp4} type="video/mp4" />
      </video>
    </div>
  );
}
