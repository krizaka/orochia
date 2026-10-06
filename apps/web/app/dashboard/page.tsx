"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  Film,
  Users,
  Wallet,
  Settings,
  Upload,
  ArrowRight,
  Sparkles,
  Lock,
  Eye,
  CheckCircle2,
  ExternalLink,
  Shield,
  CreditCard,
  Tv
} from "lucide-react";

function DashboardContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  // Demo unlocked videos library
  const unlockedVideos = [
    {
      id: "2d7f8c91-9921-4d30-b2aa-c819a5f255cc",
      title: "Velvet Lounge Private Session — 4K Uncut Director's Cut",
      creatorName: "Elena Vox",
      duration: "47:30",
      unlockedAt: "Oct 6, 2026",
      tipAmount: "$10.00",
      thumbnail: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80",
    },
    {
      id: "3e8a9d02-1134-4e41-c3bb-d928b6e366dd",
      title: "Midnight Noir: Acoustic Lounge & Intimate Studio Session",
      creatorName: "Mia Sterling",
      duration: "33:00",
      unlockedAt: "Oct 4, 2026",
      tipAmount: "$5.00",
      thumbnail: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80",
    },
  ];

  // Demo ledger transactions
  const ledgerHistory = [
    {
      id: "tx-9941",
      date: "Today, 14:22",
      type: "CONTENT_UNLOCK_TIP",
      creator: "Elena Vox",
      amountCents: 1000,
      status: "COMPLETED",
      gateway: "CCBill Adult Visa",
    },
    {
      id: "tx-9812",
      date: "Oct 4, 2026",
      type: "DIRECT_STREAM_TIP",
      creator: "Mia Sterling",
      amountCents: 500,
      status: "COMPLETED",
      gateway: "Crypto USDT-TRC20",
    },
    {
      id: "tx-9740",
      date: "Oct 2, 2026",
      type: "WALLET_DEPOSIT",
      creator: "Platform Balance",
      amountCents: 5000,
      status: "COMPLETED",
      gateway: "NowPayments Crypto",
    },
  ];

  // Settings form states
  const [displayName, setDisplayName] = useState(user?.displayName || "Elena Vox");
  const [bio, setBio] = useState(user?.bio || "Visual artist & director exploring late-night neon narratives.");
  const [cryptoAddress, setCryptoAddress] = useState("TLvQZ...7X9kY (USDT-TRC20)");
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h2 className="text-2xl font-bold text-white font-display">Session Required</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Please log in or register to access your personal space.
        </p>
        <Link
          href="/auth/login"
          className="mt-6 inline-block rounded-xl bg-violet-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const isCreator = user.role === "CREATOR";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Top Banner / User Identity */}
      <div className="relative mb-8 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-violet-950/60 via-zinc-950 to-fuchsia-950/50 p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded-2xl border-2 border-violet-500/40 bg-zinc-800 shadow-xl">
              <img src={user.avatarUrl} alt={user.displayName} className="h-full w-full object-cover" />
              <div className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-zinc-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-3xl font-black text-white font-display">{user.displayName}</h1>
                <span className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">
                  {isCreator ? "Sovereign Creator" : "Sanctuary Patron"}
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">@{user.username} • {user.email}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>18+ Age Verified & Sovereign Covenant Active</span>
              </div>
            </div>
          </div>

          {/* Quick Balance / Upload CTAs */}
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4 text-right">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                {isCreator ? "Net Tips Earned" : "Tip Credit Balance"}
              </span>
              <span className="font-mono text-xl sm:text-2xl font-black text-emerald-400">
                ${(user.balanceCents / 100).toFixed(2)}
              </span>
            </div>

            {isCreator && (
              <Link
                href="/creator/upload"
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-4 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:scale-105 active:scale-95 transition-all"
              >
                <Upload className="h-4 w-4" />
                <span>Upload 4K</span>
              </Link>
            )}
          </div>
        </div>

        {/* Ambient Top Glow */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-violet-600/15 blur-3xl pointer-events-none" />
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto space-x-2 border-b border-white/5 pb-3 mb-8 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 transition-all ${
            activeTab === "overview"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/25"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          }`}
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          <span>Vue d&apos;ensemble</span>
        </button>

        <button
          onClick={() => setActiveTab("library")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 transition-all ${
            activeTab === "library"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/25"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          }`}
        >
          <Film className="h-3.5 w-3.5" />
          <span>My Library ({unlockedVideos.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("following")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 transition-all ${
            activeTab === "following"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/25"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Contacts & Creators</span>
        </button>

        <button
          onClick={() => setActiveTab("wallet")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 transition-all ${
            activeTab === "wallet"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/25"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          }`}
        >
          <Wallet className="h-3.5 w-3.5" />
          <span>Tips Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab("collections")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 transition-all ${
            activeTab === "collections"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/25"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" />
          <span>Bunny Collections</span>
        </button>

        <button
          onClick={() => setActiveTab("admin_treasury")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 transition-all ${
            activeTab === "admin_treasury"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/25"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          }`}
        >
          <Shield className="h-3.5 w-3.5 text-emerald-400" />
          <span>Admin Treasury</span>
        </button>

        {isCreator && (
          <Link
            href="/creator/payouts"
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all"
          >
            <CreditCard className="h-3.5 w-3.5 text-emerald-400" />
            <span>Payout Requests</span>
          </Link>
        )}

        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 transition-all ${
            activeTab === "settings"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/25"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          }`}
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Settings</span>
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-8">
          {/* Metrics Bento Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-panel rounded-2xl p-5">
              <span className="text-[11px] font-mono uppercase text-zinc-400">
                {isCreator ? "Total Tips Received" : "Total Tips Sent"}
              </span>
              <p className="mt-2 text-2xl font-black text-white font-mono">
                ${(user.balanceCents / 100).toFixed(2)}
              </p>
              <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
                <Sparkles className="h-3 w-3" />
                <span>Double-entry ledger verified</span>
              </span>
            </div>

            <div className="glass-panel rounded-2xl p-5">
              <span className="text-[11px] font-mono uppercase text-zinc-400">
                {isCreator ? "Active Video Streams" : "Unlocked Streams"}
              </span>
              <p className="mt-2 text-2xl font-black text-white font-mono">
                {isCreator ? "4 Videos" : `${unlockedVideos.length} Videos`}
              </p>
              <span className="text-[11px] text-violet-400 flex items-center gap-1 mt-1">
                <Tv className="h-3 w-3" />
                <span>Bunny.net 4K HLS CDN</span>
              </span>
            </div>

            <div className="glass-panel rounded-2xl p-5">
              <span className="text-[11px] font-mono uppercase text-zinc-400">
                Mutual Contacts
              </span>
              <p className="mt-2 text-2xl font-black text-white font-mono">
                {user.followingCount} Creators
              </p>
              <span className="text-[11px] text-zinc-400 flex items-center gap-1 mt-1">
                <Shield className="h-3 w-3 text-emerald-400" />
                <span>Zero-trust access gate</span>
              </span>
            </div>

            <div className="glass-panel rounded-2xl p-5">
              <span className="text-[11px] font-mono uppercase text-zinc-400">
                Membership Tier
              </span>
              <p className="mt-2 text-2xl font-black text-fuchsia-400 font-display">
                Sanctuary VIP
              </p>
              <span className="text-[11px] text-zinc-400 block mt-1">
                Zero Ads • Direct Encrypted Stream
              </span>
            </div>
          </div>

          {/* Quick Access Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Unlocked Favorites */}
            <div className="glass-panel rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white font-display">Recent Unlocked Streams</h3>
                <button
                  onClick={() => setActiveTab("library")}
                  className="text-xs font-semibold text-violet-400 hover:underline flex items-center gap-1"
                >
                  <span>View All</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              <div className="space-y-3">
                {unlockedVideos.map((video) => (
                  <Link
                    key={video.id}
                    href={`/watch/${video.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-white/5 bg-zinc-900/40 p-3 hover:border-violet-500/30 transition-all group"
                  >
                    <div className="relative h-14 w-24 rounded-xl overflow-hidden bg-zinc-950 shrink-0">
                      <img src={video.thumbnail} alt={video.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                      <div className="absolute bottom-1 right-1 rounded bg-black/80 px-1 text-[9px] font-mono text-white">
                        {video.duration}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold text-white line-clamp-1 group-hover:text-violet-400 transition-colors">
                        {video.title}
                      </h4>
                      <p className="text-[11px] text-zinc-400">{video.creatorName}</p>
                      <span className="text-[10px] text-emerald-400 font-mono">Unlocked • {video.tipAmount} tip</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent Ledger Transactions */}
            <div className="glass-panel rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white font-display">Tips & Ledger Feed</h3>
                <button
                  onClick={() => setActiveTab("wallet")}
                  className="text-xs font-semibold text-violet-400 hover:underline flex items-center gap-1"
                >
                  <span>Full Ledger</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              <div className="space-y-3">
                {ledgerHistory.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-2xl border border-white/5 bg-zinc-900/40 p-3.5 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-white">{tx.creator}</p>
                      <span className="text-[10px] text-zinc-400 font-mono">{tx.gateway} • {tx.date}</span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="font-bold text-emerald-400">+${(tx.amountCents / 100).toFixed(2)}</span>
                      <span className="block text-[9px] text-zinc-500">{tx.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: My Library */}
      {activeTab === "library" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white font-display">Unlocked Stream Library</h2>
              <p className="text-xs text-zinc-400">All paywalled streams permanently unlocked by your patron tips</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {unlockedVideos.map((video) => (
              <Link
                key={video.id}
                href={`/watch/${video.id}`}
                className="glass-panel group block overflow-hidden rounded-2xl border border-white/10 hover:border-violet-500/40 transition-all"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-zinc-950">
                  <img src={video.thumbnail} alt={video.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                  <div className="absolute top-2.5 left-2.5 rounded-full bg-emerald-600/90 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-md">
                    Unlocked
                  </div>
                  <div className="absolute bottom-2.5 right-2.5 rounded-md bg-black/80 px-2 py-0.5 text-[11px] font-mono text-white">
                    {video.duration}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-white line-clamp-1 group-hover:text-violet-400 transition-colors">
                    {video.title}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">{video.creatorName}</p>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                    <span>Unlocked {video.unlockedAt}</span>
                    <span className="text-emerald-400 font-bold">{video.tipAmount}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Contacts & Following */}
      {activeTab === "following" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white font-display">Contacts & Following</h2>
            <p className="text-xs text-zinc-400">Creators you have direct contact relations and private stream access with</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                name: "Elena Vox",
                handle: "elenavox",
                avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
                bio: "Tokyo Neon & 4K Cinema. Sovereign Director.",
                status: "Mutual Contact",
              },
              {
                name: "Mia Sterling",
                handle: "miasterling",
                avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80",
                bio: "Midnight Noir Acoustic Lounge & intimate streams.",
                status: "Mutual Contact",
              },
              {
                name: "Kaelen Drake",
                handle: "kaelendrake",
                avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
                bio: "Berlin underground club culture & private visual feeds.",
                status: "Mutual Contact",
              },
            ].map((contact) => (
              <div key={contact.handle} className="glass-panel rounded-2xl p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full overflow-hidden border border-white/10 shrink-0">
                    <img src={contact.avatar} alt={contact.name} className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">{contact.name}</h4>
                    <p className="text-[10px] text-zinc-400">@{contact.handle}</p>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      {contact.status}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/profile`}
                  className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Wallet & Tips Ledger */}
      {activeTab === "wallet" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white font-display">Cryptographic Tips Ledger</h2>
              <p className="text-xs text-zinc-400">Double-entry immutable record of all payments, unlocks, and tips</p>
            </div>
            {isCreator && (
              <Link
                href="/creator/payouts"
                className="rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all text-center"
              >
                Request Creator Payout
              </Link>
            )}
          </div>

          <div className="glass-panel overflow-hidden rounded-3xl">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/5 bg-zinc-900/60 font-mono uppercase text-zinc-400">
                <tr>
                  <th className="px-5 py-3.5">Transaction ID</th>
                  <th className="px-5 py-3.5">Counterparty</th>
                  <th className="px-5 py-3.5">Processor / Rail</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-zinc-300">
                {ledgerHistory.map((tx) => (
                  <tr key={tx.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="px-5 py-4 font-mono text-zinc-400">{tx.id}</td>
                    <td className="px-5 py-4 font-semibold text-white">{tx.creator}</td>
                    <td className="px-5 py-4 text-violet-300 font-mono">{tx.gateway}</td>
                    <td className="px-5 py-4 text-zinc-400">{tx.date}</td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-emerald-400">
                      +${(tx.amountCents / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Bunny Collections */}
      {activeTab === "collections" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white font-display">Bunny.net Video Collections & Vaults</h2>
              <p className="text-xs text-zinc-400">
                Organize episodic series, VIP patron vaults, and private archives with Bunny Stream Library API
              </p>
            </div>
            <Link
              href="/creator/upload"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Add Stream to Collection</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="rounded-3xl border border-white/10 bg-zinc-900/60 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                  Bunny col-tokyo-4k
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">Public Series</span>
              </div>
              <h3 className="text-base font-bold text-white">Tokyo Neon Nights</h3>
              <p className="text-xs text-zinc-400 mt-1 mb-4">
                Official 4K episodic documentary on Tokyo underground nightlife and art lounges.
              </p>
              <div className="flex items-center justify-between border-t border-white/5 pt-3 text-xs font-mono text-zinc-400">
                <span>6 Episodes</span>
                <span className="text-violet-400">Adaptive 4K HLS</span>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-zinc-900/60 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-bold text-fuchsia-300">
                  Bunny col-vault-uncut
                </span>
                <span className="text-[10px] text-amber-400 font-mono">Paywalled Vault</span>
              </div>
              <h3 className="text-base font-bold text-white">Velvet Private Vault</h3>
              <p className="text-xs text-zinc-400 mt-1 mb-4">
                Exclusive unreleased performance recordings and private patron streams with token HMAC.
              </p>
              <div className="flex items-center justify-between border-t border-white/5 pt-3 text-xs font-mono text-zinc-400">
                <span>4 Private Streams</span>
                <span className="text-emerald-400">$10 Unlock Bundle</span>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-zinc-900/60 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-300">
                  Bunny col-acoustic-noir
                </span>
                <span className="text-[10px] text-violet-400 font-mono">Audio & 4K</span>
              </div>
              <h3 className="text-base font-bold text-white">Midnight Noir Acoustic Sessions</h3>
              <p className="text-xs text-zinc-400 mt-1 mb-4">
                Late-night studio acoustics with intimate vocals and spatial audio.
              </p>
              <div className="flex items-center justify-between border-t border-white/5 pt-3 text-xs font-mono text-zinc-400">
                <span>3 Streams</span>
                <span className="text-violet-400">98 Mins Total</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Admin Treasury & Monetization */}
      {activeTab === "admin_treasury" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 mb-2">
                <Shield className="h-3 w-3" />
                <span>Orochia Protocol Administration & Treasury</span>
              </div>
              <h2 className="text-xl font-bold text-white font-display">Platform Monetization & Revenue Ledger</h2>
              <p className="text-xs text-zinc-400">
                10% protocol rake, performer 2257 compliance desk fees, and sponsored creator spotlights
              </p>
            </div>
            <a
              href="http://localhost:3001"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:scale-105 transition-all"
            >
              <span>Launch Orochia-Admin App</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
              <span className="text-[11px] font-mono text-zinc-400">Platform Protocol Rake</span>
              <p className="text-2xl font-black text-white font-display mt-1">10.0%</p>
              <span className="text-[10px] text-zinc-500">Auto-deducted on tips</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
              <span className="text-[11px] font-mono text-zinc-400">Protocol Fee Revenue</span>
              <p className="text-2xl font-black text-emerald-400 font-mono mt-1">$4,328.00</p>
              <span className="text-[10px] text-emerald-500">From $43.2K Gross GMV</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
              <span className="text-[11px] font-mono text-zinc-400">2257 Performer Audits</span>
              <p className="text-2xl font-black text-violet-400 font-mono mt-1">$1,470.00</p>
              <span className="text-[10px] text-zinc-500">30 Verified Creators ($49)</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
              <span className="text-[11px] font-mono text-zinc-400">Sanctuary Spotlight Ads</span>
              <p className="text-2xl font-black text-fuchsia-400 font-mono mt-1">$850.00</p>
              <span className="text-[10px] text-zinc-500">34 Active Boost Days</span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-900/40 p-6">
            <h3 className="text-sm font-bold text-white mb-4">Platform Revenue Stream Specifications</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-zinc-900/80 p-3.5 border border-white/5 text-xs">
                <div>
                  <span className="font-bold text-white">Stream 1: Direct Content Unlock Rake (10%)</span>
                  <p className="text-[11px] text-zinc-400">Automatic split at CCBill/Segpay/Crypto checkout. 90% direct to creator, 10% to protocol treasury.</p>
                </div>
                <span className="font-mono font-bold text-emerald-400">+$4,328.00</span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-zinc-900/80 p-3.5 border border-white/5 text-xs">
                <div>
                  <span className="font-bold text-white">Stream 2: 18 U.S.C. § 2257 Performer Custodian Audit Fee</span>
                  <p className="text-[11px] text-zinc-400">Mandatory verification fee charged to creators for legal custodian record-keeping and KYC audit ($49 one-time).</p>
                </div>
                <span className="font-mono font-bold text-emerald-400">+$1,470.00</span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-zinc-900/80 p-3.5 border border-white/5 text-xs">
                <div>
                  <span className="font-bold text-white">Stream 3: Sanctuary Spotlight Promoted Slots</span>
                  <p className="text-[11px] text-zinc-400">Daily auction for premium placement on homepage hero & trending top 3 streams.</p>
                </div>
                <span className="font-mono font-bold text-emerald-400">+$850.00</span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-zinc-900/80 p-3.5 border border-white/5 text-xs">
                <div>
                  <span className="font-bold text-white">Stream 4: Instant Crypto Payout Fast-Lane Fee (1.5%)</span>
                  <p className="text-[11px] text-zinc-400">Convenience fee charged for instant on-chain USDT/BTC settlement instead of standard 7-day batch.</p>
                </div>
                <span className="font-mono font-bold text-emerald-400">+$395.00</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Settings */}
      {activeTab === "settings" && (
        <div className="max-w-2xl">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white font-display">Account & Profile Settings</h2>
            <p className="text-xs text-zinc-400">Customize your public sanctuary identity and settlement accounts</p>
          </div>

          {savedSuccess && (
            <div className="mb-6 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>Profile settings saved successfully to database!</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="glass-panel rounded-3xl p-6 sm:p-8 space-y-5">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
                Bio / Tagline
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-zinc-900 p-3.5 text-sm text-white focus:border-violet-500 focus:outline-none"
              />
            </div>

            {isCreator && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
                  Cryptocurrency Payout Address (USDT-TRC20 / BTC)
                </label>
                <input
                  type="text"
                  value={cryptoAddress}
                  onChange={(e) => setCryptoAddress(e.target.value)}
                  placeholder="e.g. TLvQZ9oP3x84..."
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm text-white font-mono focus:border-violet-500 focus:outline-none"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  Zero-chargeback instant settlement upon approved payout threshold.
                </span>
              </div>
            )}

            <button
              type="submit"
              className="rounded-xl bg-violet-600 hover:bg-violet-500 px-6 py-3 text-xs font-bold text-white shadow-lg transition-all"
            >
              Save Profile Settings
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black pt-28 flex items-center justify-center text-zinc-500 text-sm">
          Loading Dashboard...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
