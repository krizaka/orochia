"use client";

import React, { useEffect, useRef, useState } from "react";

import { cn } from "@/components/ui";

/** A background loop of public/backdrops (see public/CREDITS.md): a 216×384 clip, its WebP poster. */
export type BackdropClip = "hero" | "paid" | "fans" | "creators";

/**
 * The blurred footage behind a home section — the `media` of `SectionBackdrop`, which blurs and dims it (depth of
 * field: you see that something moves, never who). The poster paints first; the clip is fetched only when the
 * section comes near the screen, plays while it is on screen and pauses off it. Under prefers-reduced-motion, on a
 * data saver or a phone-sized screen, the poster stays: still, and a few kilobytes.
 * `eager` for the first screen (the hero): its posters are part of the first paint.
 * `layout="panes"` spreads the clips as tall panes at different depths (the hero); `"fill"` covers the section.
 */
export function BackdropMedia({ clips, layout = "fill", eager = false }: { clips: BackdropClip[]; layout?: "fill" | "panes"; eager?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [motion, setMotion] = useState(false);
  // Once near, the clips stay mounted (cached); the observer only plays and pauses them.
  const [near, setNear] = useState(false);

  useEffect(() => {
    const still =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(max-width: 767px)").matches ||
      Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    if (still) return;
    setMotion(true);
    const el = box.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNear(true);
        el.querySelectorAll("video").forEach((v) => (entry.isIntersecting ? void v.play().catch(() => undefined) : v.pause()));
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const media = (clip: BackdropClip, className: string) =>
    motion && near ? (
      <video
        key={clip}
        className={className}
        poster={`/backdrops/${clip}.webp`}
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        disablePictureInPicture
        tabIndex={-1}
      >
        <source src={`/backdrops/${clip}.webm`} type="video/webm" />
        <source src={`/backdrops/${clip}.mp4`} type="video/mp4" />
      </video>
    ) : (
      <img key={clip} src={`/backdrops/${clip}.webp`} alt="" decoding="async" loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} className={className} />
    );

  return (
    <div ref={box} className="orochia-backdrop-veil absolute inset-0 overflow-hidden">
      {layout === "fill" ? (
        media(clips[0], "absolute inset-0 h-full w-full scale-110 object-cover")
      ) : (
        <div className="absolute inset-y-0 right-0 grid w-full grid-cols-3 gap-[6%] px-[4%] lg:w-[72%]">
          {clips.map((clip, i) => (
            <div key={clip} className={cn("relative overflow-hidden rounded-[3rem]", i === 1 ? "mt-[18%] mb-[-8%]" : "mt-[-6%] mb-[14%]")}>
              {media(clip, "absolute inset-0 h-full w-full object-cover")}
            </div>
          ))}
        </div>
      )}
      {/* The text side stays calm: the footage fades out towards it (left on wide screens, top on phones). */}
      {layout === "panes" && <div className="absolute inset-0 bg-linear-to-b from-surface-0/80 via-surface-0/30 to-surface-0/70 lg:bg-linear-to-r lg:from-surface-0 lg:via-surface-0/50 lg:to-transparent" />}
    </div>
  );
}
