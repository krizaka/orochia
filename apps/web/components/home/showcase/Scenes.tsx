"use client";

import {
  AuctionIcon as Gavel,
  CheckIcon as BadgeCheck,
  CheckIcon as Trophy,
  ClockIcon as Clock,
  ForwardIcon as Send,
  HeartIcon as Heart,
  LinkIcon as Share2,
  MessageIcon as MessageCircle,
  PlayIcon as Play,
  TipIcon as Coins,
} from "@krizaka/icons";
import React, { useEffect, useState } from "react";

import { cn,Spinner } from "@/components/ui";
import { useI18n } from "@/lib/i18n-client";

/**
 * The phone's screens, one flow each, played like the app is used: a finger taps, a sheet slides up, a price moves.
 * The footage is illustrative (public/showcase, vertical clips); amounts show the mechanism, never an account — no
 * names, no handles, no profiles (AGENTS.md §3.F).
 */

/** Four tabs, one idea each: watch, stories, support (a tip — an unlock or a challenge backing is the same gesture), auction. */
export const SCENES = ["feed", "stories", "support", "auction"] as const;
export type Scene = (typeof SCENES)[number];
export const SCENE_MS = 7000;

const clip = (name: string) => ({ src: `/showcase/${name}.mp4`, poster: `/showcase/${name}.jpg` });

/** Steps of a scene: 0, 1, 2… every `ms`; the last step at once when motion is reduced. */
function useSteps(count: number, ms: number, still: boolean): number {
  const [step, setStep] = useState(still ? count - 1 : 0);
  useEffect(() => {
    if (still) return;
    const timer = setInterval(() => setStep((s) => Math.min(count - 1, s + 1)), ms);
    return () => clearInterval(timer);
  }, [count, ms, still]);
  return still ? count - 1 : step;
}

/** True once the page has loaded and settled: the phone's clips wait for it, so they never compete with the first paint. */
function useAfterLoad(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const go = () => (timer = setTimeout(() => setReady(true), 1500));
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
    return () => {
      window.removeEventListener("load", go);
      if (timer) clearTimeout(timer);
    };
  }, []);
  return ready;
}

function Video({ name, className = "", still }: { name: string; className?: string; still: boolean }) {
  const { src, poster } = clip(name);
  const ready = useAfterLoad();
  if (still || !ready) return <img src={poster} alt="" className={cn("absolute inset-0 h-full w-full object-cover", className)} />;
  return <video src={src} poster={poster} muted autoPlay loop playsInline preload="auto" className={cn("absolute inset-0 h-full w-full object-cover", className)} />;
}

/** A finger: where the next tap lands, with its ripple. */
function Tap({ x, y, show }: { x: string; y: string; show: boolean }) {
  if (!show) return null;
  return (
    <span aria-hidden className="sc-tap pointer-events-none absolute z-40 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90 bg-white/35 shadow-lg shadow-black/40 backdrop-blur-sm" style={{ left: x, top: y }}>
      <span className="sc-ripple absolute inset-0 rounded-full border-2 border-white" />
    </span>
  );
}

function Toast({ children, show }: { children: React.ReactNode; show: boolean }) {
  if (!show) return null;
  return (
    <div className="sc-toast absolute inset-x-4 top-12 z-30 flex items-center gap-2 rounded-2xl border border-white/15 bg-surface-0/85 px-3 py-2.5 text-[11px] font-semibold text-white shadow-2xl backdrop-blur-xl">
      {children}
    </div>
  );
}

const shade = "absolute inset-0 bg-linear-to-b from-black/50 via-transparent to-black/80";

function Rail({ liked, pulseTip }: { liked: boolean; pulseTip?: boolean }) {
  return (
    <div className="absolute bottom-20 right-3 z-20 flex flex-col items-center gap-4 text-white">
      <Heart className={cn(
        "h-6 w-6 drop-shadow-md transition-colors",
        liked ? "fill-accent text-fg-accent" : ""
      )} />
      <MessageCircle className="h-6 w-6 drop-shadow-md" />
      <span className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-warning to-warning text-fg-warning shadow-lg",
        pulseTip ? "sc-pulse" : ""
      )}>
        <Coins className="h-4.5 w-4.5" />
      </span>
      <Share2 className="h-5.5 w-5.5 drop-shadow-md" />
    </div>
  );
}

function CreatorLine({ caption }: { caption: string }) {
  const { t } = useI18n();
  return (
    <div className="absolute bottom-20 left-4 right-16 z-20 text-white">
      <p className="flex items-center gap-1.5 text-[12px] font-bold drop-shadow-md">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-linear-to-br from-accent to-accent-2 ring-2 ring-white/70">
          <BadgeCheck className="h-3.5 w-3.5" />
        </span>
        {t("home.showcase.ui.creator")}
      </p>
      <p className="mt-1.5 text-[11px] leading-snug text-white/90 drop-shadow-md">{caption}</p>
    </div>
  );
}

/** Watch: the vertical feed — a double tap likes, a swipe brings the next video. */
function Feed({ still }: { still: boolean }) {
  const { t } = useI18n();
  const step = useSteps(4, 1700, still);
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <div className="absolute inset-0 transition-transform duration-700" style={{ transform: step >= 2 ? "translateY(-100%)" : "none", transitionTimingFunction: "cubic-bezier(.16,1,.3,1)" }}>
        <div className="absolute inset-0">
          <Video name="feed-1" still={still} />
          <div className={shade} />
          <CreatorLine caption={t("home.showcase.ui.caption1")} />
          <Rail liked={step >= 1} />
          {step === 1 && <Heart aria-hidden className="sc-burst absolute left-1/2 top-[42%] h-20 w-20 -translate-x-1/2 -translate-y-1/2 fill-accent text-fg-accent" />}
        </div>
        <div className="absolute inset-0 translate-y-full">
          <Video name="feed-2" still={still} />
          <div className={shade} />
          <CreatorLine caption={t("home.showcase.ui.caption2")} />
          <Rail liked={false} />
        </div>
      </div>
      <div className="absolute inset-x-0 top-11 z-20 flex justify-center gap-5 text-[12px] font-bold">
        <span className="text-white/60">{t("home.showcase.ui.following")}</span>
        <span className="border-b-2 border-white pb-0.5 text-white">{t("home.showcase.ui.forYou")}</span>
      </div>
      <Tap x="50%" y="42%" show={!still && step === 1} />
      {!still && step === 2 && <span aria-hidden className="sc-swipe absolute left-1/2 top-[70%] z-40 h-9 w-9 -translate-x-1/2 rounded-full border-2 border-white/90 bg-white/35" />}
    </div>
  );
}

/** Stories: three clips in a row, the bars fill, a tap on the right moves on. */
function Stories({ still }: { still: boolean }) {
  const { t } = useI18n();
  const step = useSteps(3, 2300, still);
  const names = ["story-1", "story-2", "story-3"];
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <Video key={names[step]} name={names[step]} still={still} className="sc-fade" />
      <div className={shade} />
      <div className="absolute inset-x-3 top-10 z-20 flex gap-1">
        {names.map((n, i) => (
          <span key={n} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
            <span className={cn(
              "block h-full bg-white",
              i < step || still ? "w-full" : i === step ? "sc-fill" : "w-0"
            )} />
          </span>
        ))}
      </div>
      <div className="absolute inset-x-3 top-[3.6rem] z-20 flex items-center gap-2 text-white">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-linear-to-br from-accent to-accent-2 ring-2 ring-ring">
          <BadgeCheck className="h-3.5 w-3.5" />
        </span>
        <span className="text-[11px] font-bold">{t("home.showcase.ui.storyBadge")}</span>
        <span className="flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md">
          <Clock className="h-2.5 w-2.5" /> {t("home.showcase.ui.storyExpires")}
        </span>
      </div>
      <div className="absolute inset-x-3 bottom-5 z-20 flex items-center gap-2">
        <span className="flex-1 rounded-full border border-white/40 bg-black/25 px-3.5 py-2.5 text-[11px] text-white/85 backdrop-blur-md">{t("home.showcase.ui.reply")}</span>
        <Heart className="h-6 w-6 text-white" />
        <Send className="h-5.5 w-5.5 text-white" />
      </div>
      <Tap x="80%" y="50%" show={!still && step > 0} key={step} />
    </div>
  );
}

const AMOUNTS = ["$5", "$10", "$25", "$50"];

/** Tip: the coin on the rail opens the sheet, $10, send — the coins fly and the creator's share shows. */
function Tip({ still, share }: { still: boolean; share: number }) {
  const { t } = useI18n();
  const step = useSteps(6, 1100, still);
  const open = step >= 2 && step <= 4;
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <Video name="feed-2" still={still} />
      <div className={shade} />
      <CreatorLine caption={t("home.showcase.ui.caption2")} />
      <Rail liked={false} pulseTip={step === 1} />
      <div className={cn(
        "absolute inset-x-0 bottom-0 z-30 rounded-t-3xl border-t border-white/10 bg-surface-0/95 p-4 pb-6 backdrop-blur-2xl transition-transform duration-500",
        open ? "translate-y-0" : "translate-y-full"
      )} style={{ transitionTimingFunction: "cubic-bezier(.16,1,.3,1)" }}>
        <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-white/25" />
        <p className="text-[13px] font-bold text-white">{t("home.showcase.ui.tipTitle")}</p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {AMOUNTS.map((a, i) => (
            <span key={a} className={cn(
              "rounded-xl py-2.5 text-center text-[12px] font-bold transition-colors",
              i === 1 && step >= 3 ? "bg-linear-to-r from-accent to-accent-2 text-white" : "bg-white/8 text-fg-secondary"
            )}>
              {a}
            </span>
          ))}
        </div>
        <span className={cn(
          "mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-linear-to-r from-accent via-accent-2 to-accent-2 py-3 text-[12px] font-bold text-white",
          step === 4 ? "scale-95" : "",
          "transition-transform"
        )}>
          <Coins className="h-3.5 w-3.5" /> {t("home.showcase.ui.tipSend", { amount: "$10" })}
        </span>
      </div>
      {step >= 5 &&
        [0, 1, 2, 3, 4].map((i) => (
          <span key={i} aria-hidden className="sc-coin absolute bottom-24 z-30 flex h-7 w-7 items-center justify-center rounded-full bg-linear-to-br from-warning to-warning text-fg-warning shadow-lg" style={{ left: `${30 + i * 10}%`, animationDelay: `${i * 90}ms` }}>
            <Coins className="h-3.5 w-3.5" />
          </span>
        ))}
      <Toast show={step >= 5}>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success">
          <Coins className="h-3.5 w-3.5" />
        </span>
        <span>
          {t("home.showcase.ui.tipSent")} · <span className="text-fg-success">{t("home.showcase.ui.tipKeep", { share })}</span>
        </span>
      </Toast>
      <Tap x="calc(100% - 1.85rem)" y="58%" show={!still && step === 1} />
      <Tap x="37%" y="80%" show={!still && step === 3} />
      <Tap x="50%" y="89%" show={!still && step === 4} />
    </div>
  );
}

const BIDS = [12000, 13500, 15000, 16500];

/** Auction: bids land by alias, the price climbs, a last-minute bid pushes the clock back. */
function Auction({ still }: { still: boolean }) {
  const { t } = useI18n();
  const step = useSteps(5, 1250, still);
  const [seconds, setSeconds] = useState(118);
  useEffect(() => {
    if (still) return;
    const timer = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [still]);
  const price = BIDS[Math.min(step, BIDS.length - 1)];
  const extended = step >= 4;
  const clock = extended ? 120 + seconds - 112 : seconds;
  const mm = String(Math.floor(clock / 60)).padStart(2, "0");
  const ss = String(clock % 60).padStart(2, "0");
  const rows = [
    { who: t("home.showcase.ui.bidder", { n: 2 }), amount: 13500, at: 1 },
    { who: t("home.showcase.ui.you"), amount: 15000, at: 2, mine: true },
    { who: t("home.showcase.ui.bidder", { n: 3 }), amount: 16500, at: 3 },
  ].filter((r) => step >= r.at);
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-surface-0">
      <div className="relative h-[52%] shrink-0 overflow-hidden">
        <Video name="auction" still={still} />
        <div className={shade} />
        <span className="absolute left-3 top-11 z-20 flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold text-white shadow-lg">
          <Gavel className="h-3 w-3" /> {t("home.showcase.ui.auctionBadge")}
        </span>
        <span className={cn(
          "absolute right-3 top-11 z-20 rounded-full px-2.5 py-1 font-mono text-[11px] font-bold text-white shadow-lg",
          extended ? "sc-pop bg-warning" : "bg-scrim backdrop-blur-md"
        )}>
          {mm}:{ss}
        </span>
      </div>
      <div className="flex flex-1 flex-col px-4 pt-3 text-white">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-secondary">{t("home.showcase.ui.currentBid")}</p>
        <p key={price} className="sc-pop font-display text-3xl font-black tabular-nums">${(price / 100).toFixed(0)}</p>
        <ul className="mt-2 space-y-1.5">
          {rows
            .slice()
            .reverse()
            .map((r) => (
              <li key={r.amount} className={cn(
                "sc-row flex items-center justify-between rounded-xl px-3 py-1.5 text-[11px]",
                r.mine ? "bg-accent/25 font-bold" : "bg-white/6"
              )}>
                <span className="flex items-center gap-1.5">
                  {r.mine && <Trophy className="h-3 w-3 text-fg-success" />}
                  {r.who}
                </span>
                <span className="font-mono tabular-nums">${(r.amount / 100).toFixed(0)}</span>
              </li>
            ))}
        </ul>
        {extended && <p className="sc-row mt-2 text-[10px] font-semibold text-fg-warning">{t("home.showcase.ui.extended")}</p>}
        <span className="mt-auto mb-5 flex items-center justify-center gap-1.5 rounded-xl bg-linear-to-r from-accent via-accent-2 to-accent-2 py-3 text-[12px] font-bold">
          <Gavel className="h-3.5 w-3.5" /> {t("home.showcase.ui.bidCta", { amount: `$${(price / 100 + 15).toFixed(0)}` })}
        </span>
      </div>
      <Tap x="50%" y="calc(100% - 2.6rem)" show={!still && step === 2} />
    </div>
  );
}

export function Screen({ scene, share, still }: { scene: Scene; share: number; still: boolean }) {
  switch (scene) {
    case "feed":
      return <Feed still={still} />;
    case "stories":
      return <Stories still={still} />;
    case "support":
      return <Tip still={still} share={share} />;
    case "auction":
      return <Auction still={still} />;
  }
}

export const SCENE_STYLES = `
  .sc-tap { animation: sc-tap .9s cubic-bezier(.16,1,.3,1) both; }
  @keyframes sc-tap { 0% { opacity: 0; transform: translate(-50%, -50%) scale(1.4); } 35% { opacity: 1; transform: translate(-50%, -50%) scale(.85); } 100% { opacity: .9; transform: translate(-50%, -50%) scale(1); } }
  .sc-ripple { animation: sc-ripple .9s ease-out both; }
  @keyframes sc-ripple { from { opacity: .9; transform: scale(.6); } to { opacity: 0; transform: scale(2.2); } }
  .sc-swipe { animation: sc-swipe 1s cubic-bezier(.16,1,.3,1) both; }
  @keyframes sc-swipe { from { opacity: 0; transform: translate(-50%, 40px); } 30% { opacity: 1; } to { opacity: 0; transform: translate(-50%, -140px); } }
  .sc-burst { animation: sc-burst .9s cubic-bezier(.16,1,.3,1) both; }
  @keyframes sc-burst { from { opacity: 0; transform: translate(-50%, -50%) scale(.3); } 40% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); } to { opacity: 0; transform: translate(-50%, -60%) scale(1); } }
  .sc-fill { width: 0; animation: sc-fill 2.3s linear forwards; }
  @keyframes sc-fill { to { width: 100%; } }
  .sc-fade { animation: sc-fade .45s ease both; }
  @keyframes sc-fade { from { opacity: 0; } }
  .sc-toast { animation: sc-toast .55s cubic-bezier(.16,1,.3,1) both; }
  @keyframes sc-toast { from { opacity: 0; transform: translateY(-12px) scale(.96); } }
  .sc-pulse { animation: sc-pulse .9s ease-in-out infinite; }
  @keyframes sc-pulse { 50% { transform: scale(1.18); box-shadow: 0 0 0 8px rgb(251 191 36 / .25); } }
  .sc-coin { animation: sc-coin 1.4s cubic-bezier(.16,1,.3,1) both; }
  @keyframes sc-coin { from { opacity: 0; transform: translateY(0) scale(.5); } 30% { opacity: 1; } to { opacity: 0; transform: translateY(-260px) scale(1.05) rotate(25deg); } }
  .sc-progress { width: 0; animation: sc-progress 6s linear forwards; }
  @keyframes sc-progress { to { width: 60%; } }
  .sc-pop { animation: sc-pop .45s cubic-bezier(.16,1,.3,1) both; }
  @keyframes sc-pop { from { transform: scale(1.18); opacity: .4; } }
  .sc-row { animation: sc-row .45s cubic-bezier(.16,1,.3,1) both; }
  @keyframes sc-row { from { opacity: 0; transform: translateY(8px); } }
  .sc-confetti { animation: sc-confetti 1.6s ease-in both; }
  @keyframes sc-confetti { from { transform: translateY(-10px) rotate(0); opacity: 1; } to { transform: translateY(560px) rotate(540deg); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) {
    .sc-tap, .sc-ripple, .sc-swipe, .sc-burst, .sc-fill, .sc-fade, .sc-toast, .sc-pulse, .sc-coin, .sc-progress, .sc-pop, .sc-row, .sc-confetti { animation: none !important; }
  }
`;
