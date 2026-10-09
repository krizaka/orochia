"use client";

import React, { useEffect, useRef, useState } from "react";
import { BatteryFull, Clock, Coins, Flame, Gavel, PlayCircle, SignalHigh, Unlock, Wifi } from "lucide-react";
import { t } from "@/lib/i18n";
import { SCENES, SCENE_MS, SCENE_STYLES, Screen, type Scene } from "./showcase/Scenes";
import { cn } from "@/components/ui";

const ICONS: Record<Scene, typeof Coins> = { feed: PlayCircle, stories: Clock, tip: Coins, unlock: Unlock, auction: Gavel, challenge: Flame };

/**
 * How Orochia works, on a phone: six real flows (watch, stories, tip, unlock, auctions, challenges) played one after
 * the other on vertical footage — a finger taps, sheets slide, prices move — with the tabs under it to jump to one.
 * Pauses off-screen; under prefers-reduced-motion every screen shows its final state, still.
 */
export function ProductShowcase({ share }: { share: number }) {
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(true);
  const [still, setStill] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setStill(reduce);
    if (reduce) return setRunning(false);
    const observer = new IntersectionObserver(([entry]) => setRunning(entry.isIntersecting), { threshold: 0.2 });
    if (box.current) observer.observe(box.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % SCENES.length), SCENE_MS);
    return () => clearTimeout(timer);
  }, [index, running]);
  const scene = SCENES[index];

  return (
    <div ref={box} className="relative flex w-full min-w-0 flex-col items-center" aria-label={t("home.showcase.label")} role="region">
      <div className="relative">
        <div aria-hidden className="sc-aura absolute -inset-12 -z-10 rounded-full bg-linear-to-tr from-accent/45 via-accent-2/30 to-accent-2/35 blur-3xl" />
        <div className="sc-float relative h-[560px] w-[264px] rounded-[3rem] bg-linear-to-b from-device-edge via-device-core to-device-edge p-[3px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.85)] sm:h-[600px] sm:w-[284px]">
          <div className="theme-dark relative h-full w-full overflow-hidden rounded-[2.85rem] border-[7px] border-black bg-black">
            <div aria-hidden className="absolute inset-x-0 top-0 z-50 flex h-9 items-center justify-between px-6 text-[11px] font-semibold text-white">
              <span className="tabular-nums">{t("home.showcase.ui.clock")}</span>
              <span className="flex items-center gap-1">
                <SignalHigh className="h-3.5 w-3.5" />
                <Wifi className="h-3.5 w-3.5" />
                <BatteryFull className="h-4 w-4" />
              </span>
            </div>
            <div aria-hidden className="absolute left-1/2 top-2 z-50 h-[22px] w-[84px] -translate-x-1/2 rounded-full bg-black" />
            <div key={scene} className="sc-scene absolute inset-0" aria-hidden>
              <Screen scene={scene} share={share} still={still} />
            </div>
            <div aria-hidden className="absolute bottom-1.5 left-1/2 z-50 h-1 w-24 -translate-x-1/2 rounded-full bg-white/70" />
          </div>
        </div>
      </div>

      <div role="tablist" aria-label={t("home.showcase.label")} className="mt-7 grid w-full max-w-[420px] grid-cols-3 gap-1.5 sm:max-w-none sm:grid-cols-6">
        {SCENES.map((s, i) => {
          const Icon = ICONS[s];
          const active = i === index;
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setIndex(i)}
              className={cn(
                "relative flex items-center justify-center gap-1.5 overflow-hidden rounded-xl border px-2.5 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:text-xs",
                active
                  ? "border-border-strong bg-surface-3 text-fg"
                  : "border-border-default bg-surface-1/40 text-fg-secondary hover:text-fg"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{t(`home.showcase.scenes.${s}`)}</span>
              {active && running && (
                <span className="sc-tab absolute inset-x-0 bottom-0 h-[2px] origin-left bg-linear-to-r from-accent via-accent-2 to-accent-2" style={{ animationDuration: `${SCENE_MS}ms` }} />
              )}
            </button>
          );
        })}
      </div>
      <style>{SCENE_STYLES + STYLES}</style>
    </div>
  );
}

const STYLES = `
  .sc-scene { animation: sc-in .5s cubic-bezier(.16,1,.3,1) both; }
  @keyframes sc-in { from { opacity: 0; transform: scale(1.02); } }
  .sc-float { animation: sc-float 8s ease-in-out infinite; }
  @keyframes sc-float { 50% { transform: translateY(-8px); } }
  .sc-aura { animation: sc-aura 10s ease-in-out infinite; }
  @keyframes sc-aura { 50% { transform: scale(1.08) rotate(8deg); opacity: .85; } }
  .sc-tab { animation: sc-tab linear both; }
  @keyframes sc-tab { from { transform: scaleX(0); } }
  @media (prefers-reduced-motion: reduce) { .sc-scene, .sc-float, .sc-aura, .sc-tab { animation: none !important; } }
`;
