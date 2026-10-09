"use client";

import React, { useEffect, useRef, useState } from "react";
import { BadgeCheck, Coins, Flame, Gavel, Heart, Lock, MessageCircle, Radio, Scissors, Sparkles, Trophy, Unlock, UserPlus } from "lucide-react";
import { t, type MessageKey } from "@/lib/i18n";

const SCENES = ["reel", "tip", "auction", "unlock", "publish"] as const;
type Scene = (typeof SCENES)[number];
const SCENE_MS = 5000;

const ELENA_AVATAR = "/showcase/stream-elena.jpg";
const MIA_AVATAR = "/showcase/live-tips-mia.jpg";

/** One screen of the phone, per scene — realistic creator streaming and monetization in action. */
function Screen({ scene }: { scene: Scene }) {
  if (scene === "reel") {
    return (
      <div className="absolute inset-0 overflow-hidden bg-black">
        {/* Real Stream / Reel Visual */}
        <img
          src="/showcase/stream-elena.jpg"
          alt=""
          className="sc-zoom h-full w-full object-cover"
        />

        {/* Ambient Top Vignette */}
        <div className="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-black/80 via-black/40 to-transparent" />

        {/* Top Status & Stories Progress */}
        <div className="absolute inset-x-3 top-3 flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-white/30">
              <span className="sc-fill block h-full bg-white" style={{ animationDelay: `${i * 1.5}s` }} />
            </span>
          ))}
        </div>

        {/* Live Badge & Stream Header */}
        <div className="absolute inset-x-3 top-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <img src={ELENA_AVATAR} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-violet-500 shadow-md" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-black" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold text-white drop-shadow-md">{t("home.showcase.demo.creatorElena")}</span>
                <BadgeCheck className="h-3 w-3 text-violet-400" />
              </div>
              <span className="text-[9px] font-medium text-white/70">{t("home.showcase.demo.tokyoNeon")}</span>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-rose-600/90 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg shadow-rose-600/40 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
            <Radio className="h-3 w-3" /> {t("home.showcase.demo.live")} · {t("home.showcase.demo.viewers")}
          </span>
        </div>

        {/* Floating Chat Bubbles */}
        <div className="absolute inset-x-3 bottom-16 flex flex-col gap-1.5 pointer-events-none">
          <div className="sc-chat-1 flex items-center gap-1.5 rounded-xl bg-black/60 px-2.5 py-1 text-[10px] text-white/95 backdrop-blur-md border border-white/10 w-fit max-w-[85%]">
            <span className="font-bold text-violet-300">{t("home.showcase.demo.userAlex")}</span> {t("home.showcase.demo.comment1")}
          </div>
          <div className="sc-chat-2 flex items-center gap-1.5 rounded-xl bg-black/60 px-2.5 py-1 text-[10px] text-white/95 backdrop-blur-md border border-white/10 w-fit max-w-[85%]">
            <span className="font-bold text-pink-300">{t("home.showcase.demo.userSam")}</span> {t("home.showcase.demo.comment2")}
          </div>
        </div>

        {/* Floating Reaction Hearts & Sparks */}
        <div className="absolute right-4 bottom-24 flex flex-col items-center pointer-events-none">
          <Heart className="sc-heart-1 h-5 w-5 fill-rose-500 text-rose-500 drop-shadow-lg" />
          <Heart className="sc-heart-2 h-4 w-4 fill-pink-400 text-pink-400 drop-shadow-lg" />
          <Flame className="sc-heart-3 h-5 w-5 fill-amber-500 text-amber-500 drop-shadow-lg" />
        </div>

        {/* Bottom Interaction Bar */}
        <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
          <span className="flex-1 rounded-full border border-white/20 bg-black/40 px-3 py-2 text-[10px] text-white/70 backdrop-blur-md">
            {t("home.showcase.reply")}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-400">
            <Heart className="h-4 w-4 fill-pink-400" />
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-tr from-violet-600 to-pink-600 text-white shadow-lg">
            <Coins className="h-4 w-4" />
          </span>
        </div>
      </div>
    );
  }

  if (scene === "tip") {
    return (
      <div className="absolute inset-0 overflow-hidden bg-black flex flex-col">
        {/* Real Creator Singing / Lounge Image */}
        <div className="relative flex-1">
          <img
            src="/showcase/live-tips-mia.jpg"
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black via-black/20 to-black/60" />

          {/* Creator Header */}
          <div className="absolute left-3 top-6 flex items-center gap-2">
            <img src={MIA_AVATAR} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-pink-500" />
            <div>
              <p className="text-[11px] font-bold text-white drop-shadow-md">{t("home.showcase.demo.creatorMia")}</p>
              <p className="text-[9px] text-zinc-300">{t("home.showcase.demo.midnightSession")}</p>
            </div>
          </div>

          {/* Floating Gold Coin Burst */}
          <span className="sc-coin absolute bottom-24 right-10 flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-tr from-amber-400 to-yellow-300 text-amber-950 shadow-xl shadow-amber-500/50">
            <Coins className="h-5 w-5" />
          </span>

          {/* Celebratory Tip Toast Banner */}
          <div className="sc-toast absolute left-1/2 top-16 -translate-x-1/2 flex flex-col items-center gap-1 whitespace-nowrap rounded-2xl bg-linear-to-r from-emerald-600/95 via-teal-600/95 to-emerald-600/95 px-4 py-2 text-white shadow-2xl backdrop-blur-xl border border-emerald-400/30">
            <div className="flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-amber-300" />
              <span className="text-[11px] font-black tracking-wide">{t("home.showcase.demo.tipSent")}</span>
            </div>
            <span className="text-[8px] font-semibold text-emerald-100 uppercase tracking-wider">{t("home.showcase.demo.tipNote")}</span>
          </div>
        </div>

        {/* Tip Amount Selector & Creator Revenue Note */}
        <div className="bg-zinc-950 p-3 border-t border-white/10">
          <div className="mb-2 flex items-center justify-between text-[10px]">
            <span className="font-semibold text-zinc-400">{t("home.showcase.scenes.tip")}</span>
            <span className="font-bold text-emerald-400">{t("home.showcase.demo.superTipBadge")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {["$10", "$25", "$50", "$100"].map((a, i) => (
              <span
                key={a}
                className={`flex-1 rounded-xl py-2 text-center text-[10px] font-bold transition-all ${
                  i === 2
                    ? "sc-press bg-linear-to-r from-violet-600 via-fuchsia-600 to-pink-600 text-white shadow-md shadow-fuchsia-600/30 ring-1 ring-white/30"
                    : "bg-white/5 text-zinc-300 border border-white/5"
                }`}
              >
                {a}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (scene === "auction") {
    return (
      <div className="absolute inset-0 overflow-hidden bg-black flex flex-col">
        {/* Real Haute Couture Velvet Lounge Asset */}
        <div className="relative flex-1">
          <img
            src="/showcase/auction-velvet.jpg"
            alt=""
            className="h-full w-full object-cover sc-zoom"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black via-black/25 to-black/60" />

          {/* Exclusive Holographic 1-of-1 Badge */}
          <div className="absolute left-3 top-6 flex items-center gap-1.5 rounded-full bg-linear-to-r from-amber-500/90 to-purple-600/90 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-white shadow-xl backdrop-blur-md border border-amber-300/40">
            <Trophy className="h-3 w-3 text-amber-200" />
            {t("home.showcase.demo.auctionBadge")}
          </div>

          {/* Outbid Alert Pill */}
          <div className="sc-toast absolute left-1/2 top-16 -translate-x-1/2 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-500 px-3 py-1 text-[10px] font-black text-amber-950 shadow-xl border border-white/20">
            <Sparkles className="h-3 w-3" />
            {t("home.showcase.demo.outbidAlert")}
          </div>

          {/* Title & Countdown */}
          <div className="absolute inset-x-3 bottom-3 space-y-1">
            <p className="text-[12px] font-black text-white drop-shadow-md leading-tight">
              {t("home.showcase.demo.auctionTitle")}
            </p>
            <div className="flex items-center justify-between text-[10px]">
              <span className="flex items-center gap-1 font-mono text-amber-300 font-bold">
                ⏳ {t("home.showcase.demo.auctionTimer")}
              </span>
              <span className="text-zinc-400 font-medium">{t("home.showcase.demo.bidsCount")}</span>
            </div>
          </div>
        </div>

        {/* Live Bid Action Panel */}
        <div className="bg-zinc-950 p-3.5 border-t border-white/10">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-400">{t("home.showcase.demo.currentBid")}</span>
              <p className="font-display text-lg font-black text-white">$850.00</p>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-semibold text-emerald-400">{t("home.showcase.demo.collector")}</span>
              <p className="text-[9px] text-zinc-500 font-mono">{t("home.showcase.demo.bidTime")}</p>
            </div>
          </div>
          <button
            type="button"
            className="w-full rounded-xl bg-linear-to-r from-amber-500 via-fuchsia-600 to-pink-600 py-2.5 text-center text-xs font-bold text-white shadow-lg shadow-fuchsia-600/30 flex items-center justify-center gap-2"
          >
            <Gavel className="h-3.5 w-3.5" />
            {t("home.showcase.demo.placeBid")}
          </button>
        </div>
      </div>
    );
  }

  if (scene === "unlock") {
    return (
      <div className="absolute inset-0 overflow-hidden bg-black">
        {/* Real Penthouse Premiere Footage */}
        <img
          src="/showcase/unlock-premiere.jpg"
          alt=""
          className="sc-unblur h-full w-full object-cover"
        />

        {/* Frosted Glass VIP Paywall that unlocks */}
        <div className="sc-lock absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/45 backdrop-blur-md p-6 text-center">
          <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur-xl border border-white/20 shadow-2xl">
            <Lock className="sc-lock-icon h-6 w-6" />
            <Unlock className="sc-unlock-icon absolute h-6 w-6 text-emerald-400" />
          </span>

          <div>
            <span className="inline-block rounded-full bg-violet-600/80 px-2.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
              {t("home.showcase.demo.unlockBadge")}
            </span>
            <p className="mt-1 text-sm font-bold text-white drop-shadow-md">{t("home.showcase.demo.videoTitle")}</p>
          </div>

          <span className="rounded-xl bg-linear-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-4 py-2.5 text-xs font-black text-white shadow-xl shadow-fuchsia-600/30 border border-white/20">
            {t("home.showcase.demo.unlockInstant")}
          </span>
          <span className="text-[9px] font-medium text-white/70">{t("home.showcase.demo.unlockSub")}</span>
        </div>
      </div>
    );
  }

  /* publish scene: In-browser 4K Studio */
  return (
    <div className="absolute inset-0 flex flex-col bg-zinc-950">
      <div className="relative m-3 flex-1 overflow-hidden rounded-2xl bg-black">
        <img src="/showcase/stream-elena.jpg" alt="" className="sc-filter h-full w-full object-cover" />
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold text-white backdrop-blur-md">
          <Sparkles className="h-2.5 w-2.5 text-fuchsia-400" /> {t("home.showcase.demo.filter")}
        </span>
        <span className="absolute right-2 top-2 rounded-full bg-violet-600/80 px-2 py-0.5 text-[9px] font-bold text-white">
          {t("home.showcase.demo.studioBadge")}
        </span>
      </div>

      {/* Timeline with real frames */}
      <div className="mx-3 mb-2 h-9 overflow-hidden rounded-lg bg-zinc-900 border border-white/10">
        <div className="relative h-full">
          <div className="absolute inset-0 grid grid-cols-6 gap-px opacity-75">
            {Array.from({ length: 6 }, (_, i) => (
              <img
                key={i}
                src={i % 2 === 0 ? "/showcase/stream-elena.jpg" : "/showcase/auction-velvet.jpg"}
                alt=""
                className="h-full w-full object-cover"
              />
            ))}
          </div>
          <span className="sc-trim-l absolute inset-y-0 left-0 w-2 rounded-l-md bg-white shadow-md" />
          <span className="sc-trim-r absolute inset-y-0 right-0 w-2 rounded-r-md bg-white shadow-md" />
        </div>
      </div>

      <div className="mx-3 mb-3 rounded-xl bg-white/5 p-2.5 border border-white/10">
        <div className="mb-1.5 flex justify-between text-[9px] font-semibold text-white">
          <span className="flex items-center gap-1.5">
            <Scissors className="h-3 w-3 text-violet-400" /> {t("home.showcase.publishing")}
          </span>
          <span className="sc-count font-mono text-violet-300" />
        </div>
        <span className="block h-1.5 overflow-hidden rounded-full bg-white/10">
          <span className="sc-upload block h-full rounded-full bg-linear-to-r from-violet-500 to-pink-500" />
        </span>
      </div>
    </div>
  );
}

const TOASTS: { icon: React.ElementType; key: MessageKey; tone: string; place: string }[] = [
  { icon: UserPlus, key: "home.showcase.toasts.follow", tone: "bg-violet-500", place: "-left-12 top-12" },
  { icon: Coins, key: "home.showcase.toasts.tip", tone: "bg-emerald-500", place: "-right-14 top-36" },
  { icon: Gavel, key: "home.showcase.toasts.auction", tone: "bg-amber-500", place: "-left-14 bottom-32" },
  { icon: Unlock, key: "home.showcase.toasts.unlock", tone: "bg-pink-500", place: "-right-12 bottom-12" },
];

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
        {/* Ambient Neon Atmosphere Glow */}
        <div aria-hidden className="absolute -inset-10 -z-10 rounded-full bg-linear-to-tr from-violet-600/40 via-fuchsia-500/35 to-pink-500/35 blur-3xl light:from-violet-300/50 light:via-fuchsia-200/50 light:to-pink-200/50" />

        {/* Premium Hardware Phone Mockup */}
        <div className="sc-float relative h-[490px] w-[240px] rounded-[2.8rem] border-[3px] border-white/20 bg-zinc-950 p-2 shadow-2xl shadow-black/80 ring-1 ring-white/10 light:border-slate-300 light:bg-white light:shadow-violet-900/25 sm:h-[550px] sm:w-[270px]">
          <div className="relative h-full w-full overflow-hidden rounded-[2.3rem] bg-black">
            {/* Dynamic Island with camera lens reflection */}
            <div aria-hidden className="absolute left-1/2 top-2.5 z-30 h-4.5 w-20 -translate-x-1/2 rounded-full bg-black/90 border border-white/10 flex items-center justify-end pr-2">
              <span className="h-2 w-2 rounded-full bg-zinc-900 border border-zinc-700" />
            </div>

            {/* Screen View */}
            <div key={scene} className="sc-scene absolute inset-0" aria-hidden>
              <Screen scene={scene} />
            </div>

            {/* Glass Shimmer Highlight */}
            <div aria-hidden className="pointer-events-none absolute inset-0 z-20 bg-linear-to-tr from-transparent via-white/5 to-transparent opacity-60" />
          </div>
        </div>

        {/* Live notification floating pills around phone */}
        <div aria-hidden className="hidden md:block">
          {TOASTS.map(({ icon: Icon, key, tone, place }, i) => (
            <div
              key={key}
              className={`sc-toast-float absolute ${place} flex items-center gap-2 whitespace-nowrap rounded-2xl border border-white/15 bg-zinc-950/90 px-3.5 py-2 text-xs font-semibold text-white shadow-2xl backdrop-blur-xl light:border-black/5 light:bg-white/95 light:text-slate-800`}
              style={{ animationDelay: `${i * 1.5}s` }}
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-full ${tone} text-white shadow-sm`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              {t(key)}
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Scene Switcher Tabs */}
      <div
        className="mt-6 flex max-w-full gap-1 overflow-x-auto rounded-full border border-white/15 bg-zinc-950/80 p-1 backdrop-blur-xl scrollbar-none light:border-black/10 light:bg-white/90 shadow-xl"
        role="tablist"
        aria-label={t("home.showcase.label")}
      >
        {SCENES.map((s, i) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={i === index}
            onClick={() => setIndex(i)}
            className={`relative shrink-0 overflow-hidden whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all sm:px-3.5 sm:text-xs ${
              i === index
                ? "bg-white/15 text-white light:bg-black/10 light:text-slate-900 shadow-xs"
                : "text-zinc-400 hover:text-white light:text-slate-500 hover:light:text-slate-900"
            }`}
          >
            <span className="mr-1 font-mono text-[10px] opacity-60">{String(i + 1).padStart(2, "0")}</span>
            {t(`home.showcase.scenes.${s}`)}
            {i === index && running && (
              <span
                className="sc-tab absolute inset-x-0 bottom-0 h-[2px] bg-linear-to-r from-violet-500 via-fuchsia-500 to-pink-500"
                style={{ animationDuration: `${SCENE_MS}ms` }}
              />
            )}
          </button>
        ))}
      </div>

      <style>{STYLES}</style>
    </div>
  );
}

const STYLES = `
  .sc-scene { animation: sc-in .6s cubic-bezier(.16,1,.3,1) both; }
  @keyframes sc-in { from { opacity: 0; transform: scale(1.03); } }
  .sc-float { animation: sc-float 7s ease-in-out infinite; }
  @keyframes sc-float { 50% { transform: translateY(-8px) rotate(-0.5deg); } }
  .sc-zoom { animation: sc-zoom 5s ease-out both; }
  @keyframes sc-zoom { from { transform: scale(1.08); } }
  .sc-fill { width: 0; animation: sc-fill 1.5s linear forwards; }
  @keyframes sc-fill { to { width: 100%; } }
  .sc-chat-1 { animation: sc-chat 0.6s 0.8s cubic-bezier(.16,1,.3,1) both; }
  .sc-chat-2 { animation: sc-chat 0.6s 1.6s cubic-bezier(.16,1,.3,1) both; }
  @keyframes sc-chat { from { opacity: 0; transform: translateY(8px); } }
  .sc-heart-1 { animation: sc-float-heart 3s 1s ease-in-out infinite both; }
  .sc-heart-2 { animation: sc-float-heart 2.6s 1.8s ease-in-out infinite both; }
  .sc-heart-3 { animation: sc-float-heart 3.2s 1.4s ease-in-out infinite both; }
  @keyframes sc-float-heart { 0% { opacity: 0; transform: translateY(0) scale(0.6); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(-70px) scale(1.1) rotate(-10deg); } }
  .sc-filter { animation: sc-filter 5s ease-in-out both; }
  @keyframes sc-filter { 0%, 30% { filter: none; } 60%, 100% { filter: contrast(1.15) saturate(1.25) hue-rotate(-8deg); } }
  .sc-trim-l { animation: sc-trim-l 2.5s .4s ease-in-out both; }
  @keyframes sc-trim-l { to { left: 16%; } }
  .sc-trim-r { animation: sc-trim-r 2.5s .4s ease-in-out both; }
  @keyframes sc-trim-r { to { right: 14%; } }
  .sc-upload { width: 0; animation: sc-upload 3.8s .5s cubic-bezier(.4,0,.2,1) forwards; }
  @keyframes sc-upload { to { width: 100%; } }
  .sc-press { animation: sc-press .6s 1.2s both; }
  @keyframes sc-press { 50% { transform: scale(.93); } }
  .sc-coin { animation: sc-coin 1.8s 1.2s cubic-bezier(.16,1,.3,1) both; }
  @keyframes sc-coin { from { transform: translateY(40px) scale(.4); opacity: 0; } 50% { opacity: 1; } to { transform: translateY(-110px) scale(1); opacity: 0; } }
  .sc-toast { animation: sc-toast 2.8s 1.4s cubic-bezier(.16,1,.3,1) both; }
  @keyframes sc-toast { from { opacity: 0; transform: translate(-50%, -12px); } 12%, 88% { opacity: 1; transform: translate(-50%, 0); } to { opacity: 0; } }
  .sc-unblur { animation: sc-unblur 4.8s ease both; }
  @keyframes sc-unblur { 0%, 45% { filter: blur(14px) brightness(.7); transform: scale(1.08); } 75%, 100% { filter: none; transform: scale(1); } }
  .sc-lock { animation: sc-lock 4.8s ease both; }
  @keyframes sc-lock { 0%, 55% { opacity: 1; } 75%, 100% { opacity: 0; pointer-events: none; } }
  .sc-lock-icon { animation: sc-hide 4.8s both; }
  .sc-unlock-icon { opacity: 0; animation: sc-show 4.8s both; }
  @keyframes sc-hide { 0%, 40% { opacity: 1; } 45%, 100% { opacity: 0; } }
  @keyframes sc-show { 0%, 40% { opacity: 0; } 45%, 100% { opacity: 1; } }
  .sc-toast-float { animation: sc-toast-float 6s ease-in-out infinite both; }
  @keyframes sc-toast-float { 0%, 100% { opacity: 0; transform: translateY(10px) scale(.96); } 12%, 70% { opacity: 1; transform: translateY(0) scale(1); } 85% { opacity: 0; transform: translateY(-8px); } }
  .sc-tab { transform-origin: left; animation: sc-tab linear both; }
  @keyframes sc-tab { from { transform: scaleX(0); } }
  .sc-count::after { content: "100%"; animation: sc-count 3.8s .5s steps(1) both; }
  @keyframes sc-count { 0% { content: "0%"; } 25% { content: "34%"; } 50% { content: "68%"; } 75% { content: "92%"; } 100% { content: "100%"; } }
  @media (prefers-reduced-motion: reduce) {
    .sc-scene, .sc-float, .sc-zoom, .sc-fill, .sc-filter, .sc-trim-l, .sc-trim-r, .sc-upload, .sc-press, .sc-coin, .sc-toast, .sc-unblur, .sc-lock, .sc-lock-icon, .sc-unlock-icon, .sc-toast-float, .sc-tab, .sc-chat-1, .sc-chat-2, .sc-heart-1, .sc-heart-2, .sc-heart-3 { animation: none !important; }
    .sc-fill, .sc-upload { width: 100%; }
    .sc-toast-float { opacity: 1; }
  }
`;
