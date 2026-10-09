"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, Clapperboard, Clock, Coins, Flame, Gavel, Lock, ShieldCheck, Sparkles, Target, Trophy, Undo2, Upload, Users } from "lucide-react";
import { t } from "@/lib/i18n";

/**
 * What Orochia does, one mechanism per scene, on a phone. Nothing in it pretends to be someone: there are no names,
 * no faces, no counters — only the product's own rules (the audiences a video can have, the tip presets, the auction's
 * escrow and soft close, a challenge's all-or-nothing goal, the creator's share) drawn over real thumbnails of the platform, or its default artwork while
 * it is empty. Pauses off-screen; still under prefers-reduced-motion.
 */
const SCENES = ["publish", "audience", "stories", "tip", "auction", "challenge"] as const;
type Scene = (typeof SCENES)[number];
const SCENE_MS = 5200;
const FALLBACK = ["/defaults/banners/banner-04.svg", "/defaults/banners/banner-02.svg", "/defaults/banners/banner-06.svg"];
const AUDIENCES = ["public", "followers", "contacts", "paid", "invited"] as const;
const TIPS = ["$5", "$10", "$25", "$50"];

function Cover({ src, className = "" }: { src: string; className?: string }) {
  return <img src={src} alt="" className={`h-full w-full object-cover ${className}`} />;
}

function Screen({ scene, covers, share }: { scene: Scene; covers: string[]; share: number }) {
  const [a, b, c] = [covers[0], covers[1 % covers.length], covers[2 % covers.length]];
  if (scene === "publish") {
    return (
      <div className="absolute inset-0 flex flex-col bg-zinc-950">
        <div className="relative m-3 mt-10 flex-1 overflow-hidden rounded-2xl">
          <Cover src={a} className="sc-develop" />
          <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[9px] font-bold text-white backdrop-blur-md">4K</span>
        </div>
        <ol className="mx-3 mb-4 space-y-2 rounded-2xl bg-white/5 p-3 text-[10px] font-semibold text-white">
          {(["upload", "encode", "ready"] as const).map((step, i) => (
            <li key={step} className="sc-step flex items-center gap-2" style={{ animationDelay: `${0.4 + i * 1.3}s` }}>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-linear-to-br from-violet-600 to-pink-600">
                {i === 0 ? <Upload className="h-3 w-3" /> : i === 1 ? <Sparkles className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
              </span>
              {t(`home.showcase.publish.${step}`)}
              <Check className="sc-tick ml-auto h-3.5 w-3.5 text-emerald-400" style={{ animationDelay: `${1.2 + i * 1.3}s` }} />
            </li>
          ))}
        </ol>
      </div>
    );
  }
  if (scene === "audience") {
    return (
      <div className="absolute inset-0 flex flex-col bg-zinc-950">
        <div className="relative mx-3 mt-10 h-36 overflow-hidden rounded-2xl">
          <Cover src={b} className="sc-veil" />
        </div>
        <p className="mx-4 mt-4 text-[11px] font-bold text-white">{t("home.showcase.audience.title")}</p>
        <ul className="mx-3 mt-2 space-y-1.5">
          {AUDIENCES.map((key, i) => (
            <li
              key={key}
              className="sc-pick flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-[10px] font-semibold text-zinc-300"
              style={{ animationDelay: `${i * 0.85}s` }}
            >
              {key === "paid" ? <Lock className="h-3 w-3 text-fuchsia-400" /> : <Users className="h-3 w-3 text-violet-400" />}
              {t(`home.showcase.audience.${key}`)}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (scene === "stories") {
    return (
      <div className="absolute inset-0 bg-black">
        <Cover src={c} className="sc-zoom" />
        <div className="absolute inset-x-3 top-9 flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-white/30">
              <span className="sc-fill block h-full bg-white" style={{ animationDelay: `${i * 1.6}s` }} />
            </span>
          ))}
        </div>
        <span className="absolute left-3 top-12 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-semibold text-white backdrop-blur-md">
          <Clock className="h-2.5 w-2.5" /> {t("home.showcase.stories.expires")}
        </span>
        <span className="absolute inset-x-3 bottom-4 rounded-full border border-white/30 bg-black/30 px-3 py-2 text-[10px] text-white/80 backdrop-blur-md">
          {t("home.showcase.stories.reply")}
        </span>
      </div>
    );
  }
  if (scene === "tip") {
    return (
      <div className="absolute inset-0 flex flex-col bg-zinc-950">
        <div className="relative flex-1 overflow-hidden">
          <Cover src={a} />
          <div className="absolute inset-0 bg-linear-to-t from-zinc-950 via-zinc-950/30 to-transparent" />
          <span className="sc-coin absolute bottom-6 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-linear-to-tr from-amber-400 to-yellow-200 text-amber-950 shadow-xl shadow-amber-500/40">
            <Coins className="h-5 w-5" />
          </span>
        </div>
        <div className="space-y-2 p-3">
          <p className="text-[11px] font-bold text-white">{t("home.showcase.tip.title")}</p>
          <div className="flex gap-1.5">
            {TIPS.map((amount, i) => (
              <span
                key={amount}
                className={`flex-1 rounded-xl py-2 text-center text-[10px] font-bold ${i === 1 ? "sc-press bg-linear-to-r from-violet-600 to-pink-600 text-white" : "bg-white/5 text-zinc-300"}`}
              >
                {amount}
              </span>
            ))}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <span className="sc-share block h-full rounded-full bg-emerald-400" style={{ width: `${share}%` }} />
          </div>
          <p className="text-[9px] font-semibold text-emerald-300">{t("home.showcase.tip.keep", { share })}</p>
        </div>
      </div>
    );
  }
  if (scene === "challenge") {
    return (
      <div className="absolute inset-0 flex flex-col items-center bg-zinc-950 px-4 pt-12">
        <span className="flex items-center gap-1 rounded-full bg-fuchsia-600/90 px-2 py-0.5 text-[9px] font-bold text-white">
          <Flame className="h-2.5 w-2.5" /> {t("home.showcase.challenge.badge")}
        </span>
        <div className="relative mt-5 h-36 w-36">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className="stroke-white/10" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray="100"
              className="sc-ring stroke-fuchsia-500"
            />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center text-white">
            <Target className="h-5 w-5 text-fuchsia-300" />
            <span className="mt-1 text-[10px] font-bold uppercase tracking-wider">{t("home.showcase.challenge.goal")}</span>
          </span>
        </div>
        <div className="mt-5 flex w-full gap-1.5">
          {TIPS.map((amount, i) => (
            <span
              key={amount}
              className={`sc-step flex-1 rounded-xl py-2 text-center text-[10px] font-bold ${i === 2 ? "bg-linear-to-r from-violet-600 to-pink-600 text-white" : "bg-white/5 text-zinc-300"}`}
              style={{ animationDelay: `${0.3 + i * 0.25}s` }}
            >
              {amount}
            </span>
          ))}
        </div>
        <p className="sc-step mt-4 text-center text-[10px] leading-snug text-zinc-300" style={{ animationDelay: "1.6s" }}>
          {t("home.showcase.challenge.allOrNothing")}
        </p>
        <p className="sc-step mt-2 flex items-center gap-1 text-[10px] font-bold text-emerald-300" style={{ animationDelay: "3.4s" }}>
          <Check className="h-3 w-3" /> {t("home.showcase.challenge.made")}
        </p>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex flex-col bg-zinc-950">
      <div className="relative mx-3 mt-10 h-32 overflow-hidden rounded-2xl">
        <Cover src={b} />
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-fuchsia-600/90 px-2 py-0.5 text-[9px] font-bold text-white">
          <Gavel className="h-2.5 w-2.5" /> {t("home.showcase.auction.badge")}
        </span>
      </div>
      <ol className="mx-3 mt-3 space-y-1.5">
        {(
          [
            ["held", Lock, "text-violet-300"],
            ["outbid", Undo2, "text-sky-300"],
            ["softClose", Clock, "text-amber-300"],
            ["winner", Trophy, "text-emerald-300"],
          ] as const
        ).map(([key, Icon, tone], i) => (
          <li
            key={key}
            className="sc-step flex items-start gap-2 rounded-xl bg-white/5 px-3 py-2 text-[10px] leading-snug text-zinc-200"
            style={{ animationDelay: `${0.3 + i * 1.05}s` }}
          >
            <Icon className={`mt-px h-3 w-3 shrink-0 ${tone}`} /> {t(`home.showcase.auction.${key}`)}
          </li>
        ))}
      </ol>
    </div>
  );
}

const ICONS: Record<Scene, typeof Upload> = {
  publish: Clapperboard,
  audience: Users,
  stories: Clock,
  tip: Coins,
  auction: Gavel,
  challenge: Flame,
};

export function ProductShowcase({ images, share }: { images: string[]; share: number }) {
  const covers = images.length >= 3 ? images.slice(0, 6) : FALLBACK;
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setRunning(false);
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
        <div
          aria-hidden
          className="sc-aura absolute -inset-10 -z-10 rounded-full bg-linear-to-tr from-violet-600/40 via-fuchsia-500/30 to-pink-500/30 blur-3xl light:from-violet-300/50 light:via-fuchsia-200/50 light:to-pink-200/50"
        />
        <div className="sc-float relative h-[490px] w-[240px] rounded-[2.8rem] border-[3px] border-white/20 bg-zinc-950 p-2 shadow-2xl shadow-black/70 ring-1 ring-white/10 light:border-slate-300 light:shadow-violet-900/25 sm:h-[540px] sm:w-[266px]">
          <div className="theme-dark relative h-full w-full overflow-hidden rounded-[2.3rem] bg-black">
            <div aria-hidden className="absolute left-1/2 top-2.5 z-30 h-4.5 w-20 -translate-x-1/2 rounded-full bg-black" />
            <div key={scene} className="sc-scene absolute inset-0" aria-hidden>
              <Screen scene={scene} covers={covers} share={share} />
            </div>
            <div aria-hidden className="pointer-events-none absolute inset-0 z-20 bg-linear-to-tr from-transparent via-white/5 to-transparent" />
          </div>
        </div>
      </div>
      <div
        role="tablist"
        aria-label={t("home.showcase.label")}
        className="mt-6 flex max-w-full gap-1 overflow-x-auto rounded-full border border-white/15 bg-zinc-950/80 p-1 shadow-xl backdrop-blur-xl scrollbar-none light:border-black/10 light:bg-white/90"
      >
        {SCENES.map((s, i) => {
          const Icon = ICONS[s];
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => setIndex(i)}
              className={`relative flex shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors sm:text-xs ${
                i === index
                  ? "bg-white/15 text-white light:bg-black/10 light:text-slate-900"
                  : "text-zinc-400 hover:text-white light:text-slate-500 hover:light:text-slate-900"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {t(`home.showcase.scenes.${s}`)}
              {i === index && running && (
                <span
                  className="sc-tab absolute inset-x-0 bottom-0 h-[2px] bg-linear-to-r from-violet-500 via-fuchsia-500 to-pink-500"
                  style={{ animationDuration: `${SCENE_MS}ms` }}
                />
              )}
            </button>
          );
        })}
      </div>
      <style>{STYLES}</style>
    </div>
  );
}

const STYLES = `
  .sc-scene { animation: sc-in .6s cubic-bezier(.16,1,.3,1) both; }
  @keyframes sc-in { from { opacity: 0; transform: scale(1.03); } }
  .sc-float { animation: sc-float 7s ease-in-out infinite; }
  @keyframes sc-float { 50% { transform: translateY(-8px) rotate(-.5deg); } }
  .sc-aura { animation: sc-aura 9s ease-in-out infinite; }
  @keyframes sc-aura { 50% { transform: scale(1.08) rotate(8deg); opacity: .8; } }
  .sc-zoom { animation: sc-zoom 5.2s ease-out both; }
  @keyframes sc-zoom { from { transform: scale(1.1); } }
  .sc-develop { animation: sc-develop 4.5s ease both; }
  @keyframes sc-develop { 0% { filter: blur(10px) grayscale(1) brightness(.6); } 70%, 100% { filter: none; } }
  .sc-veil { animation: sc-veil 5s ease both; }
  @keyframes sc-veil { 0%, 55% { filter: none; } 75%, 100% { filter: blur(8px) brightness(.7); } }
  .sc-fill { width: 0; animation: sc-fill 1.6s linear forwards; }
  @keyframes sc-fill { to { width: 100%; } }
  .sc-step { animation: sc-step .5s cubic-bezier(.16,1,.3,1) both; }
  @keyframes sc-step { from { opacity: 0; transform: translateY(8px); } }
  .sc-tick { animation: sc-tick .4s cubic-bezier(.16,1,.3,1) both; }
  @keyframes sc-tick { from { opacity: 0; transform: scale(.4); } }
  .sc-pick { animation: sc-pick .9s ease both; }
  @keyframes sc-pick { 40% { border-color: rgb(217 70 239 / .7); background: rgb(217 70 239 / .15); color: white; } }
  .sc-press { animation: sc-press .6s 1.1s both; }
  @keyframes sc-press { 50% { transform: scale(.92); } }
  .sc-coin { animation: sc-coin 1.8s 1.4s cubic-bezier(.16,1,.3,1) both; }
  @keyframes sc-coin { from { opacity: 0; transform: translate(-50%, 50px) scale(.4); } 50% { opacity: 1; } to { opacity: 0; transform: translate(-50%, -120px) scale(1); } }
  .sc-share { transform-origin: left; animation: sc-grow 1.6s 1.6s cubic-bezier(.16,1,.3,1) both; }
  @keyframes sc-grow { from { transform: scaleX(0); } }
  .sc-tab { transform-origin: left; animation: sc-grow linear both; }
  .sc-ring { stroke-dashoffset: 100; animation: sc-ring 3.2s .4s cubic-bezier(.16,1,.3,1) forwards; }
  @keyframes sc-ring { to { stroke-dashoffset: 0; } }
  @media (prefers-reduced-motion: reduce) {
    .sc-scene, .sc-float, .sc-aura, .sc-zoom, .sc-develop, .sc-veil, .sc-fill, .sc-step, .sc-tick, .sc-pick, .sc-press, .sc-coin, .sc-share, .sc-tab, .sc-ring { animation: none !important; }
    .sc-ring { stroke-dashoffset: 0; }
    .sc-fill { width: 100%; }
  }
`;
