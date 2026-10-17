"use client";

import { DeviceFrame } from "@krizaka/ui/step-showcase";
import React, { useEffect, useRef, useState } from "react";

import { cn } from "@/components/ui";

export interface TourStep {
  id: string;
  title: string;
  description: string;
  alt: string;
}

/** Index of the beat a moment of the take belongs to (`beats` are the seconds at which each step starts, ascending). */
export function beatAt(beats: readonly number[], seconds: number): number {
  let index = 0;
  beats.forEach((start, i) => {
    if (seconds >= start) index = i;
  });
  return index;
}

/**
 * The home's tour: ONE continuous take of the real app on a phone (the vertical feed, her story, the tip, her earnings),
 * its four steps beside it following the take's own time (a step lights up when its beat starts; choosing one seeks the
 * take there). On a desktop the phone sits in a device frame over a soft blur of the same footage, so no black is left
 * around it; on a phone the clip alone fills the width. Under reduced motion or a data saver the poster stays and the
 * play button starts it.
 */
export function HomeTour({
  label,
  steps,
  beats,
  video,
  poster,
  words,
}: {
  label: string;
  steps: readonly TourStep[];
  beats: readonly number[];
  video: { webm: string; mp4: string };
  poster: string;
  words: { play: string; pause: string; step: string };
}) {
  const main = useRef<HTMLVideoElement>(null);
  const backdrop = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [framed, setFramed] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 768px)");
    const quiet = window.matchMedia("(prefers-reduced-motion: reduce)").matches || Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    setStill(quiet);
    if (quiet) main.current?.pause();
    const sync = () => setFramed(wide.matches);
    sync();
    wide.addEventListener("change", sync);
    return () => wide.removeEventListener("change", sync);
  }, []);

  // The soft backdrop follows the take (same file, same time): it is only ever a blur of it.
  useEffect(() => {
    const v = main.current;
    const b = backdrop.current;
    if (!v) return;
    const onTime = () => {
      setActive(beatAt(beats, v.currentTime));
      if (b && Math.abs(b.currentTime - v.currentTime) > 0.4) b.currentTime = v.currentTime;
    };
    const onPlay = () => {
      setPlaying(true);
      void b?.play().catch(() => undefined);
    };
    const onPause = () => {
      setPlaying(false);
      b?.pause();
    };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [beats, framed]);

  const choose = (i: number) => {
    const v = main.current;
    if (!v) return;
    v.currentTime = beats[i] ?? 0;
    setActive(i);
    void v.play().catch(() => undefined);
  };
  const toggle = () => {
    const v = main.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => undefined);
    else v.pause();
  };

  const clip = (ref: React.RefObject<HTMLVideoElement | null>, className: string, props: React.ComponentProps<"video"> = {}) => (
    <video ref={ref} muted loop playsInline autoPlay={!still} preload="auto" poster={poster} className={className} {...props}>
      <source src={video.webm} type="video/webm" />
      <source src={video.mp4} type="video/mp4" />
    </video>
  );

  return (
    <section aria-label={label} className="grid w-full items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-12" data-testid="home-tour">
      <ol className="order-2 flex flex-col gap-2 md:order-1">
        {steps.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => choose(i)}
              aria-current={i === active ? "step" : undefined}
              aria-label={`${words.step.replace("{n}", String(i + 1)).replace("{total}", String(steps.length))} — ${s.title}`}
              className={cn(
                "w-full rounded-2xl border px-4 py-3 text-start transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                i === active ? "border-accent/60 bg-surface-1 shadow-lg" : "border-transparent hover:bg-surface-1/60",
              )}
            >
              <span className="flex items-baseline gap-3">
                <span className={cn("font-mono text-xs font-semibold", i === active ? "text-fg-accent" : "text-fg-muted")}>{String(i + 1).padStart(2, "0")}</span>
                <span className={cn("text-base font-bold", i === active ? "text-fg" : "text-fg-secondary")}>{s.title}</span>
              </span>
              <span className={cn("mt-1 block ps-8 text-sm leading-snug", i === active ? "text-fg-secondary" : "text-fg-muted")}>{s.description}</span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" onClick={toggle} className="ms-4 mt-2 text-xs font-semibold text-fg-accent underline-offset-4 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
            {playing ? words.pause : words.play}
          </button>
        </li>
      </ol>

      <div className="relative order-1 isolate mx-auto w-full max-w-[22rem] md:order-2 md:max-w-none md:py-8">
        {framed && (
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[2.5rem]">
            {clip(backdrop, "h-full w-full scale-150 object-cover opacity-70 blur-3xl saturate-150", { tabIndex: -1 })}
            <div className="absolute inset-0 bg-surface-0/45" />
          </div>
        )}
        {framed ? (
          <DeviceFrame kind="phone" className="mx-auto w-[17.5rem]">
            {clip(main, "block h-full w-full object-cover", { "aria-label": steps[active]?.alt, "data-testid": "home-tour-video" } as React.ComponentProps<"video">)}
          </DeviceFrame>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-border-default shadow-lg">{clip(main, "block aspect-[390/844] w-full object-cover", { "aria-label": steps[active]?.alt, "data-testid": "home-tour-video" } as React.ComponentProps<"video">)}</div>
        )}
      </div>
    </section>
  );
}
