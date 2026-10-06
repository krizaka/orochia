import React from "react";
import Link from "next/link";
import { Flame, Shield, Award, Users, Key, Zap, Lock, ArrowLeft, ArrowRight } from "lucide-react";

export const metadata = {
  title: "The Orochia Codex — Community Story & Sovereign Manifesto",
  description: "The founding lore and the 7 Tenets of the Sovereign Creator Community.",
};

export default function CodexPage() {
  const tenets = [
    {
      number: "I",
      title: "Bodily & Creative Sovereignty",
      desc: "Creators retain 100% intellectual custody over their likeness, voice, and media. No platform holds arbitrary claim to your art.",
      icon: Award,
    },
    {
      number: "II",
      title: "Transparent & Sovereign Split",
      desc: "Centralized giants extract 20% to 40% of creator earnings. In the Sanctuary, creators keep 90% to 100% of all generated patronage.",
      icon: Zap,
    },
    {
      number: "III",
      title: "Armor of Absolute Consent",
      desc: "The Sanctuary stands on uncompromising ethics. Every participant is a verified adult (18+) with immutable consent records (2257 compliance).",
      icon: Shield,
    },
    {
      number: "IV",
      title: "Inalienable Privacy & Discretion",
      desc: "Zero tracking pixels, zero ad-broker surveillance. Patrons and creators interact with cryptographic privacy, including USDT/Crypto tipping.",
      icon: Key,
    },
    {
      number: "V",
      title: "Cryptographic Edge Distribution",
      desc: "Media streams are fortified by 300-second HMAC-SHA256 Bunny Edge tokens. No hotlinking, no rampant leeching, zero unauthenticated scraping.",
      icon: Lock,
    },
    {
      number: "VI",
      title: "Direct Patron Communion",
      desc: "Zero corporate algorithms suppressing creator feeds or shadowbanning artistic expression. You connect directly with your audience.",
      icon: Users,
    },
    {
      number: "VII",
      title: "Open-Source Guardianship",
      desc: "Orochia is free and open-source software under Apache-2.0. Anyone can audit the security, run their own instance, and own their future.",
      icon: Flame,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Orochia Streams</span>
      </Link>

      {/* Hero Narrative */}
      <div className="relative mb-16 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-950/70 via-zinc-950 to-fuchsia-950/50 p-8 sm:p-14 shadow-2xl">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1 text-xs font-semibold text-violet-300 mb-6">
            <Flame className="h-3.5 w-3.5 text-fuchsia-400" />
            <span>The Serpent&apos;s Covenant</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight font-display">
            The Orochia Codex: <br />
            <span className="text-gradient-neon">
              Sovereignty Over Silence.
            </span>
          </h1>

          <p className="mt-5 text-base text-zinc-300 leading-relaxed font-light">
            In an era where centralized corporate platforms arbitrarily demonetize, shadowban, and exploit
            the world&apos;s most creative adult and independent performers, <strong className="text-white font-medium">Orochia</strong> was born.
            Named after the mythological multifaceted guardian serpent, we are an underground sanctuary
            dedicated to cryptographic ownership, bulletproof streaming, and financial freedom.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/creator/upload"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-6 py-3.5 text-xs font-bold text-white shadow-lg shadow-fuchsia-600/25 transition-all hover:scale-105"
            >
              <span>Join as Sovereign Creator</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/legal/terms"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-zinc-900 px-6 py-3.5 text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
            >
              <span>Read Legal Covenant</span>
            </Link>
          </div>
        </div>

        {/* Ambient Glow */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/4 h-80 w-80 rounded-full bg-fuchsia-600/20 blur-3xl pointer-events-none" />
      </div>

      {/* The 7 Tenets Grid */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-8">
          <Shield className="h-5 w-5 text-violet-400" />
          <h2 className="text-2xl font-bold text-white font-display">
            The 7 Tenets of the Sovereign Creator
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tenets.map((tenet) => {
            const IconComponent = tenet.icon;
            return (
              <div
                key={tenet.number}
                className="glass-panel group rounded-2xl p-6 sm:p-8 transition-all duration-300 hover:border-violet-500/40 hover:shadow-xl hover:shadow-violet-950/20"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-2xl font-black text-violet-400/60 group-hover:text-violet-400 transition-colors">
                    {tenet.number}
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/10 text-violet-400 group-hover:bg-violet-600 group-hover:text-white transition-all">
                    <IconComponent className="h-5 w-5" />
                  </div>
                </div>

                <h3 className="text-lg font-bold text-white font-display mb-2 group-hover:text-violet-300 transition-colors">
                  {tenet.title}
                </h3>

                <p className="text-sm text-zinc-400 leading-relaxed">
                  {tenet.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
