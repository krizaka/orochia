import React from "react";

import { type Recording } from "@/lib/site-media";

/**
 * A recording of the real application, from the CDN: the poster paints first, the clip is fetched only when played
 * (`preload="none"`), with its WebM and MP4 encodings. The caption says what happens; nothing here is mocked.
 */
export function RecordingClip({ media, label, caption, frameLabel }: { media: Recording; label: string; caption: string; frameLabel: string }) {
  return (
    <figure className="overflow-hidden rounded-3xl border border-border-default bg-surface-1/70">
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2 font-mono text-[11px] text-fg-muted">
        <span aria-hidden className="h-2 w-2 rounded-full bg-accent" /> {frameLabel}
      </div>
      <video controls playsInline preload="none" poster={media.poster} aria-label={`${label}. ${caption}`} className="aspect-video w-full bg-surface-0">
        <source src={media.webm} type="video/webm" />
        <source src={media.mp4} type="video/mp4" />
      </video>
      <figcaption className="p-4">
        <p className="text-sm font-bold text-fg">{label}</p>
        <p className="mt-1 text-sm leading-relaxed text-fg-secondary">{caption}</p>
      </figcaption>
    </figure>
  );
}
