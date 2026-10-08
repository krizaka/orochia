"use client";

import React, { useEffect, useRef, useState } from "react";
import { BadgeCheck, Coins, Heart, Lock, MessageCircle, Scissors, Sparkles, Unlock, UserPlus } from "lucide-react";
import { t, type MessageKey } from "@/lib/i18n";

const SCENES = ["story", "publish", "tip", "unlock"] as const;
type Scene = (typeof SCENES)[number];
const SCENE_MS = 4200;
const AVATAR = "/defaults/avatars/avatar-08.svg";
const FAN = "/defaults/avatars/avatar-03.svg";
const COVERS = ["/defaults/banners/banner-04.svg", "/defaults/banners/banner-02.svg", "/defaults/banners/banner-06.svg"];

/** One screen of the phone, per scene — built from the product's own pieces, so it follows the theme. */
function Screen({ scene }: { scene: Scene }) {
  if (scene === "story") {
    return (
      <div className="absolute inset-0">
        <img src={COVERS[0]} alt="" className="sc-zoom h-full w-full object-cover" />
        <div className="absolute inset-x-3 top-3 flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <span className="sc-fill block h-full bg-white" style={{ animationDelay: `${i * 1.3}s` }} />
            </span>
          ))}
        </div>
        <div className="absolute left-3 top-6 flex items-center gap-2">
          <img src={AVATAR} alt="" className="h-7 w-7 rounded-full ring-2 ring-fuchsia-500" />
          <span className="text-[11px] font-semibold text-white drop-shadow">{t("home.showcase.demo.storyAuthor")}</span>
        </div>
        <div className="absolute inset-x-3 bottom-4 flex items-center gap-2">
          <span className="flex-1 rounded-full border border-white/40 bg-black/20 px-3 py-2 text-[10px] text-white/80 backdrop-blur">{t("home.showcase.reply")}</span>
          <Heart className="sc-pop h-6 w-6 fill-pink-500 text-pink-500" />
        </div>
      </div>
    );
  }
  if (scene === "publish") {
    return (
      <div className="absolute inset-0 flex flex-col bg-zinc-950">
        <div className="relative m-3 flex-1 overflow-hidden rounded-2xl">
          <img src={COVERS[1]} alt="" className="sc-filter h-full w-full object-cover" />
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-semibold text-white backdrop-blur">
            <Sparkles className="h-2.5 w-2.5" /> {t("home.showcase.demo.filter")}
          </span>
        </div>
        <div className="mx-3 mb-2 h-9 overflow-hidden rounded-lg bg-zinc-800">
          <div className="relative h-full">
            <div className="absolute inset-0 grid grid-cols-6 gap-px opacity-80">
              {Array.from({ length: 6 }, (_, i) => (
                <img key={i} src={COVERS[i % 3]} alt="" className="h-full w-full object-cover" />
              ))}
            </div>
            <span className="sc-trim-l absolute inset-y-0 left-0 w-2 rounded-l-md bg-white" />
            <span className="sc-trim-r absolute inset-y-0 right-0 w-2 rounded-r-md bg-white" />
          </div>
        </div>
        <div className="mx-3 mb-3 rounded-xl bg-white/5 p-2">
          <div className="mb-1 flex justify-between text-[9px] font-semibold text-white">
            <span className="flex items-center gap-1">
              <Scissors className="h-2.5 w-2.5" /> {t("home.showcase.publishing")}
            </span>
            <span className="sc-count" />
          </div>
          <span className="block h-1.5 overflow-hidden rounded-full bg-white/10">
            <span className="sc-upload block h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500" />
          </span>
        </div>
      </div>
    );
  }
  if (scene === "tip") {
    return (
      <div className="absolute inset-0 flex flex-col">
        <div className="relative flex-1">
          <img src={COVERS[2]} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10">
            <p className="text-[11px] font-bold text-white">{t("home.showcase.demo.videoTitle")}</p>
            <p className="flex items-center gap-1 text-[9px] text-white/70">
              {t("home.showcase.demo.creator")} <BadgeCheck className="h-2.5 w-2.5 text-violet-300" />
            </p>
          </div>
          <span className="sc-coin absolute bottom-20 right-8 flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-lg">
            <Coins className="h-4 w-4" />
          </span>
          <span className="sc-toast absolute left-1/2 top-6 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-bold text-white shadow-lg">{t("home.showcase.demo.tipSent")}</span>
        </div>
        <div className="flex items-center gap-2 bg-zinc-950 p-3">
          {["$5", "$10", "$25"].map((a, i) => (
            <span key={a} className={`flex-1 rounded-lg py-1.5 text-center text-[10px] font-bold ${i === 1 ? "sc-press bg-gradient-to-r from-violet-600 to-pink-600 text-white" : "bg-white/5 text-zinc-300"}`}>
              {a}
            </span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="absolute inset-0">
      <img src={COVERS[0]} alt="" className="sc-unblur h-full w-full object-cover" />
      <div className="sc-lock absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md">
          <Lock className="sc-lock-icon h-5 w-5" />
          <Unlock className="sc-unlock-icon absolute h-5 w-5" />
        </span>
        <span className="rounded-full bg-gradient-to-r from-violet-600 to-pink-600 px-3 py-1.5 text-[10px] font-bold text-white">{t("home.showcase.unlockFor")}</span>
      </div>
    </div>
  );
}

const TOASTS: { icon: React.ElementType; key: MessageKey; tone: string; place: string }[] = [
  { icon: UserPlus, key: "home.showcase.toasts.follow", tone: "bg-violet-500", place: "-left-10 top-16" },
  { icon: Coins, key: "home.showcase.toasts.tip", tone: "bg-emerald-500", place: "-right-14 top-40" },
  { icon: MessageCircle, key: "home.showcase.toasts.message", tone: "bg-sky-500", place: "-left-16 bottom-28" },
];

/**
 * The home's moving pitch: a phone that plays what Orochia does — a story, editing and publishing, a tip, an unlock —
 * with live notifications floating around it and the scene names below (clickable). Built in code, so it follows the
 * light and dark themes. Pauses off screen; a single still scene under prefers-reduced-motion.
 */
export function ProductShowcase() {
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return setRunning(false);
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
    <div ref={box} className="relative flex flex-col items-center" aria-label={t("home.showcase.label")} role="region">
      <div className="relative">
        {/* Glow */}
        <div aria-hidden className="absolute -inset-10 -z-10 rounded-full bg-gradient-to-tr from-violet-600/40 via-fuchsia-500/30 to-pink-500/30 blur-3xl light:from-violet-300/50 light:via-fuchsia-200/50 light:to-pink-200/50" />
        {/* Phone */}
        <div className="sc-float relative h-[480px] w-[236px] rounded-[2.6rem] border border-white/15 bg-zinc-900 p-2 shadow-2xl shadow-black/60 light:border-black/10 light:bg-white light:shadow-violet-900/20 sm:h-[540px] sm:w-[266px]">
          <div className="relative h-full w-full overflow-hidden rounded-[2.1rem] bg-black">
            <span aria-hidden className="absolute left-1/2 top-2 z-20 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
            <div key={scene} className="sc-scene absolute inset-0" aria-hidden>
              <Screen scene={scene} />
            </div>
          </div>
        </div>
        {/* Live notifications around the phone */}
        <div aria-hidden className="hidden md:block">
          {TOASTS.map(({ icon: Icon, key, tone, place }, i) => (
            <div
              key={key}
              className={`sc-toast-float absolute ${place} flex items-center gap-2 whitespace-nowrap rounded-2xl border border-white/10 bg-zinc-900/85 px-3 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-xl light:border-black/5 light:bg-white/90 light:text-slate-800`}
              style={{ animationDelay: `${i * 1.6}s` }}
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-full ${tone} text-white`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              {i === 1 ? <img src={FAN} alt="" className="hidden" /> : null}
              {t(key)}
            </div>
          ))}
        </div>
      </div>

      {/* Scene names: what the phone is showing, and a way to choose */}
      <div className="mt-6 flex max-w-full gap-1 overflow-x-auto rounded-full border border-white/10 bg-zinc-950/70 p-1 backdrop-blur-xl [scrollbar-width:none] light:border-black/5 light:bg-white/80" role="tablist" aria-label={t("home.showcase.label")}>
        {SCENES.map((s, i) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={i === index}
            onClick={() => setIndex(i)}
            className={`relative shrink-0 overflow-hidden whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors sm:px-3.5 sm:text-xs ${
              i === index ? "bg-white/10 text-white light:bg-black/5 light:text-slate-900" : "text-zinc-400 hover:text-white light:text-slate-500 light:hover:text-slate-900"
            }`}
          >
            <span className="mr-1 font-mono text-[10px] opacity-60">{String(i + 1).padStart(2, "0")}</span>
            {t(`home.showcase.scenes.${s}`)}
            {i === index && running && <span className="sc-tab absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-violet-500 to-pink-500" style={{ animationDuration: `${SCENE_MS}ms` }} />}
          </button>
        ))}
      </div>
      <style>{STYLES}</style>
    </div>
  );
}

const STYLES = `
  .sc-scene { animation: sc-in .7s cubic-bezier(.16,1,.3,1) both; }
  @keyframes sc-in { from { opacity: 0; transform: scale(1.04); } }
  .sc-float { animation: sc-float 7s ease-in-out infinite; }
  @keyframes sc-float { 50% { transform: translateY(-10px) rotate(-1deg); } }
  .sc-zoom { animation: sc-zoom 4.2s ease-out both; }
  @keyframes sc-zoom { from { transform: scale(1.12); } }
  .sc-fill { width: 0; animation: sc-fill 1.3s linear forwards; }
  @keyframes sc-fill { to { width: 100%; } }
  .sc-pop { animation: sc-pop 1s 2.6s cubic-bezier(.34,1.56,.64,1) both; }
  @keyframes sc-pop { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.3); opacity: 1; } }
  .sc-filter { animation: sc-filter 4.2s ease-in-out both; }
  @keyframes sc-filter { 0%, 30% { filter: none; } 60%, 100% { filter: contrast(1.15) saturate(1.3) hue-rotate(-12deg); } }
  .sc-trim-l { animation: sc-trim-l 2s .4s ease-in-out both; }
  @keyframes sc-trim-l { to { left: 18%; } }
  .sc-trim-r { animation: sc-trim-r 2s .4s ease-in-out both; }
  @keyframes sc-trim-r { to { right: 12%; } }
  .sc-upload { width: 0; animation: sc-upload 3.4s .5s cubic-bezier(.4,0,.2,1) forwards; }
  @keyframes sc-upload { to { width: 100%; } }
  .sc-press { animation: sc-press .5s 1s both; }
  @keyframes sc-press { 50% { transform: scale(.9); } }
  .sc-coin { animation: sc-coin 1.6s 1.3s cubic-bezier(.16,1,.3,1) both; }
  @keyframes sc-coin { from { transform: translateY(40px) scale(.4); opacity: 0; } 60% { opacity: 1; } to { transform: translateY(-120px) scale(1); opacity: 0; } }
  .sc-toast { animation: sc-toast 2.4s 1.6s cubic-bezier(.16,1,.3,1) both; }
  @keyframes sc-toast { from { opacity: 0; transform: translate(-50%, -12px); } 15%, 85% { opacity: 1; transform: translate(-50%, 0); } to { opacity: 0; } }
  .sc-unblur { animation: sc-unblur 4.2s ease both; }
  @keyframes sc-unblur { 0%, 45% { filter: blur(14px) brightness(.7); transform: scale(1.1); } 70%, 100% { filter: none; transform: scale(1); } }
  .sc-lock { animation: sc-lock 4.2s ease both; }
  @keyframes sc-lock { 0%, 55% { opacity: 1; } 75%, 100% { opacity: 0; } }
  .sc-lock-icon { animation: sc-hide 4.2s both; }
  .sc-unlock-icon { opacity: 0; animation: sc-show 4.2s both; }
  @keyframes sc-hide { 0%, 40% { opacity: 1; } 45%, 100% { opacity: 0; } }
  @keyframes sc-show { 0%, 40% { opacity: 0; } 45%, 100% { opacity: 1; } }
  .sc-toast-float { animation: sc-toast-float 6s ease-in-out infinite both; }
  @keyframes sc-toast-float { 0%, 100% { opacity: 0; transform: translateY(10px) scale(.96); } 12%, 70% { opacity: 1; transform: translateY(0) scale(1); } 85% { opacity: 0; transform: translateY(-8px); } }
  .sc-tab { transform-origin: left; animation: sc-tab linear both; }
  @keyframes sc-tab { from { transform: scaleX(0); } }
  .sc-count::after { content: "100%"; animation: sc-count 3.4s .5s steps(1) both; }
  @keyframes sc-count { 0% { content: "0%"; } 25% { content: "31%"; } 50% { content: "58%"; } 75% { content: "86%"; } 100% { content: "100%"; } }
  @media (prefers-reduced-motion: reduce) {
    .sc-scene, .sc-float, .sc-zoom, .sc-fill, .sc-pop, .sc-filter, .sc-trim-l, .sc-trim-r, .sc-upload, .sc-press, .sc-coin, .sc-toast, .sc-unblur, .sc-lock, .sc-lock-icon, .sc-unlock-icon, .sc-toast-float, .sc-tab { animation: none !important; }
    .sc-fill, .sc-upload { width: 100%; }
    .sc-toast-float { opacity: 1; }
  }
`;
