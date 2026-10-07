"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { VideoManager, type StudioVideo } from "@/components/dashboard/VideoManager";
import { NetworkPanel } from "@/components/dashboard/NetworkPanel";
import { PlaylistsPanel } from "@/components/dashboard/PlaylistsPanel";
import { ListsPanel } from "@/components/dashboard/ListsPanel";
import {
  LayoutDashboard,
  Film,
  Wallet,
  Settings,
  Upload,
  Shield,
  CheckCircle2,
  CreditCard,
  Clapperboard,
  Users,
  ListVideo,
  ListChecks,
} from "lucide-react";

interface LibraryEntry {
  id: string;
  title: string;
  creatorName: string;
  durationSeconds: number;
  unlockedAt: string;
  amountPaidCents: number;
  thumbnailUrl: string | null;
}

interface LedgerLine {
  id: string;
  createdAt: string;
  entryType: string;
  counterparty: string;
  amountCents: number;
  gateway: string;
}

interface Upload {
  id: string;
  title: string;
  visibility: string;
  viewsCount: number;
  tipsCount: number;
  durationSeconds: number;
}

interface Dashboard {
  library: LibraryEntry[];
  ledger: LedgerLine[];
  uploads: StudioVideo[];
  pendingPayoutCents: number;
}

interface Treasury {
  protocolRakePercent: number;
  grossCents: number;
  platformFeeCents: number;
  creatorNetCents: number;
  creditsCount: number;
  payoutsRequestedCents: number;
  payoutsSettledCents: number;
}

type Tab = "overview" | "library" | "ledger" | "uploads" | "network" | "playlists" | "lists" | "treasury" | "settings";

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const duration = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function TabButton({ tab, active, onSelect, icon: Icon, children }: {
  tab: Tab;
  active: Tab;
  onSelect: (tab: Tab) => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => onSelect(tab)}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 transition-all ${
        active === tab ? "bg-violet-600 text-white shadow-md shadow-violet-600/25" : "text-zinc-400 hover:text-white hover:bg-zinc-900"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{children}</span>
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-white/5 bg-zinc-900/30 p-8 text-center text-xs text-zinc-400">{children}</p>;
}

function LedgerTable({ lines, isCreator }: { lines: LedgerLine[]; isCreator: boolean }) {
  if (lines.length === 0) return <Empty>No transactions yet.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
          <tr>
            <th className="py-2 pr-4">Date</th>
            <th className="py-2 pr-4">Type</th>
            <th className="py-2 pr-4">{isCreator ? "From" : "Creator"}</th>
            <th className="py-2 pr-4">Gateway</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {lines.map((tx) => (
            <tr key={tx.id} className="text-zinc-300">
              <td className="py-2.5 pr-4 font-mono text-zinc-400">{day(tx.createdAt)}</td>
              <td className="py-2.5 pr-4">{tx.entryType.replace(/_/g, " ").toLowerCase()}</td>
              <td className="py-2.5 pr-4">{tx.counterparty}</td>
              <td className="py-2.5 pr-4 text-zinc-400">{tx.gateway}</td>
              <td className={`py-2.5 text-right font-mono font-bold ${tx.amountCents < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                {money(tx.amountCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DashboardContent() {
  const { user, refresh } = useAuth();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>((searchParams.get("tab") as Tab) || "overview");
  const [data, setData] = useState<Dashboard | null>(null);
  const [treasury, setTreasury] = useState<Treasury | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [payoutAddress, setPayoutAddress] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/me/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setData(((await res.json()) as { data: Dashboard }).data);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setBio(user.bio ?? "");
    setPayoutAddress(user.payoutAddressCrypto ?? "");
    void load();
    if (user.role === "ADMIN") {
      fetch("/api/platform/treasury", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((body: { data: Treasury } | null) => setTreasury(body?.data ?? null))
        .catch(() => setTreasury(null));
    }
  }, [user, load]);

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveState("saving");
    const res = await fetch("/api/me/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, bio, payoutAddressCrypto: payoutAddress }),
    });
    setSaveState(res.ok ? "saved" : "error");
    if (res.ok) await refresh();
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h2 className="text-2xl font-bold text-white font-display">Session Required</h2>
        <p className="mt-2 text-sm text-zinc-400">Sign in or register to access your personal space.</p>
        <Link href="/auth/login" className="mt-6 inline-block rounded-xl bg-violet-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg">
          Sign In
        </Link>
      </div>
    );
  }

  const isCreator = user.role === "CREATOR";
  const isAdmin = user.role === "ADMIN";
  const spentCents = isCreator ? 0 : (data?.ledger ?? []).reduce((sum, tx) => sum + tx.amountCents, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="relative mb-8 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-violet-950/60 via-zinc-950 to-fuchsia-950/50 p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded-2xl border-2 border-violet-500/40 bg-zinc-800 shadow-xl">
              <img src={user.avatarUrl} alt={user.displayName} className="h-full w-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-3xl font-black text-white font-display">{user.displayName}</h1>
                <span className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">
                  {isAdmin ? "Administrator" : isCreator ? "Creator" : "Patron"}
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">@{user.username} • {user.email}</p>
              {user.isAgeVerified && (
                <div className="mt-2 flex items-center gap-2 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>18+ age certified</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isCreator && (
              <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4 text-right">
                <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400">Available balance</span>
                <span className="font-mono text-xl sm:text-2xl font-black text-emerald-400">{money(user.balanceCents)}</span>
              </div>
            )}
            {isCreator && (
              <Link
                href="/creator/upload"
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-4 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:scale-105 active:scale-95 transition-all"
              >
                <Upload className="h-4 w-4" />
                <span>Upload</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="flex overflow-x-auto space-x-2 border-b border-white/5 pb-3 mb-8 text-xs font-semibold">
        <TabButton tab="overview" active={activeTab} onSelect={setActiveTab} icon={LayoutDashboard}>Overview</TabButton>
        <TabButton tab="library" active={activeTab} onSelect={setActiveTab} icon={Film}>
          My Library ({data?.library.length ?? 0})
        </TabButton>
        <TabButton tab="ledger" active={activeTab} onSelect={setActiveTab} icon={Wallet}>Ledger</TabButton>
        {isCreator && (
          <TabButton tab="uploads" active={activeTab} onSelect={setActiveTab} icon={Clapperboard}>
            My Videos ({data?.uploads.length ?? 0})
          </TabButton>
        )}
        {isCreator && (
          <Link href="/creator/payouts" className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all">
            <CreditCard className="h-3.5 w-3.5 text-emerald-400" />
            <span>Payouts</span>
          </Link>
        )}
        <TabButton tab="network" active={activeTab} onSelect={setActiveTab} icon={Users}>Network</TabButton>
        <TabButton tab="playlists" active={activeTab} onSelect={setActiveTab} icon={ListVideo}>Collections</TabButton>
        <TabButton tab="lists" active={activeTab} onSelect={setActiveTab} icon={ListChecks}>Lists</TabButton>
        {isAdmin && <TabButton tab="treasury" active={activeTab} onSelect={setActiveTab} icon={Shield}>Treasury</TabButton>}
        <TabButton tab="settings" active={activeTab} onSelect={setActiveTab} icon={Settings}>Settings</TabButton>
      </div>

      {loadError && <Empty>The dashboard could not be loaded. Please try again later.</Empty>}

      {activeTab === "overview" && data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-panel rounded-2xl p-5">
            <span className="text-[11px] font-mono uppercase text-zinc-400">{isCreator ? "Available balance" : "Total spent"}</span>
            <p className="mt-2 text-2xl font-black text-white font-mono">{money(isCreator ? user.balanceCents : spentCents)}</p>
            <span className="text-[11px] text-zinc-500 mt-1 block">Computed from the ledger</span>
          </div>
          <div className="glass-panel rounded-2xl p-5">
            <span className="text-[11px] font-mono uppercase text-zinc-400">{isCreator ? "Published videos" : "Unlocked videos"}</span>
            <p className="mt-2 text-2xl font-black text-white font-mono">{isCreator ? data.uploads.length : data.library.length}</p>
          </div>
          <div className="glass-panel rounded-2xl p-5">
            <span className="text-[11px] font-mono uppercase text-zinc-400">{isCreator ? "Payouts in progress" : "Transactions"}</span>
            <p className="mt-2 text-2xl font-black text-white font-mono">
              {isCreator ? money(data.pendingPayoutCents) : data.ledger.length}
            </p>
          </div>
        </div>
      )}

      {activeTab === "library" && data && (
        data.library.length === 0 ? (
          <Empty>Videos you unlock appear here.</Empty>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.library.map((video) => (
              <Link key={video.id} href={`/watch/${video.id}`} className="glass-panel rounded-2xl overflow-hidden group">
                <div className="aspect-video bg-zinc-800 overflow-hidden">
                  {video.thumbnailUrl && (
                    <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                  )}
                </div>
                <div className="p-4">
                  <h4 className="text-sm font-bold text-white line-clamp-1">{video.title}</h4>
                  <p className="text-xs text-zinc-400">{video.creatorName}</p>
                  <p className="mt-2 text-[11px] font-mono text-zinc-500">
                    {duration(video.durationSeconds)} • unlocked {day(video.unlockedAt)} • {money(video.amountPaidCents)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )
      )}

      {activeTab === "ledger" && data && (
        <div className="glass-panel rounded-3xl p-6">
          <LedgerTable lines={data.ledger} isCreator={isCreator} />
        </div>
      )}

      {activeTab === "uploads" && isCreator && data && <VideoManager videos={data.uploads} onChange={() => void load()} />}

      {activeTab === "network" && <NetworkPanel isCreator={isCreator} />}

      {activeTab === "playlists" && <PlaylistsPanel />}
      {activeTab === "lists" && <ListsPanel />}

      {activeTab === "treasury" && isAdmin && (
        treasury ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              ["Gross volume", money(treasury.grossCents), `${treasury.creditsCount} payments`],
              ["Platform fees", money(treasury.platformFeeCents), `${treasury.protocolRakePercent}% of gross`],
              ["Creator earnings", money(treasury.creatorNetCents), "net of fees"],
              ["Payouts in progress", money(treasury.payoutsRequestedCents), "requested, not settled"],
              ["Payouts settled", money(treasury.payoutsSettledCents), "paid to creators"],
            ].map(([label, value, hint]) => (
              <div key={label} className="glass-panel rounded-2xl p-5">
                <span className="text-[11px] font-mono uppercase text-zinc-400">{label}</span>
                <p className="mt-2 text-2xl font-black text-emerald-400 font-mono">{value}</p>
                <span className="text-[11px] text-zinc-500">{hint}</span>
              </div>
            ))}
          </div>
        ) : (
          <Empty>Treasury figures are unavailable.</Empty>
        )
      )}

      {activeTab === "settings" && (
        <form onSubmit={saveSettings} className="glass-panel rounded-3xl p-6 sm:p-8 space-y-5 max-w-2xl">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">Display name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={80}
              className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              maxLength={1000}
              className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
            />
          </div>
          {isCreator && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">Crypto payout address</label>
              <input
                value={payoutAddress}
                onChange={(e) => setPayoutAddress(e.target.value)}
                maxLength={200}
                placeholder="USDT-TRC20 / BTC address"
                className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm font-mono text-white focus:border-violet-500 focus:outline-none"
              />
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saveState === "saving"}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-2.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {saveState === "saving" ? "Saving…" : "Save"}
            </button>
            {saveState === "saved" && <span className="text-xs text-emerald-400">Saved.</span>}
            {saveState === "error" && <span className="text-xs text-rose-400">Could not save.</span>}
          </div>
        </form>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-24 text-center text-xs text-zinc-500 font-mono">Loading…</div>}>
      <DashboardContent />
    </Suspense>
  );
}
