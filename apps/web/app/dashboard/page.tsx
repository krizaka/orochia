"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { money } from "@/lib/money";
import { VideoManager, type StudioVideo } from "@/components/dashboard/VideoManager";
import { NetworkPanel } from "@/components/dashboard/NetworkPanel";
import { PlaylistsPanel } from "@/components/dashboard/PlaylistsPanel";
import { ListsPanel } from "@/components/dashboard/ListsPanel";
import { InvitationsPanel } from "@/components/dashboard/InvitationsPanel";
import { ProfileSettingsPanel } from "@/components/dashboard/ProfileSettingsPanel";
import { ProfileHero } from "@/components/profile/ProfileHero";
import {
  LayoutDashboard,
  Film,
  Wallet,
  Settings,
  Upload,
  Shield,
  CreditCard,
  Clapperboard,
  Users,
  ListVideo,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { cn } from "@/components/ui";

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

type Tab = "overview" | "library" | "ledger" | "uploads" | "network" | "playlists" | "lists" | "invitations" | "treasury" | "settings";

const duration = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** A dashboard tab is a link (/dashboard?tab=…): the address always says where you are, so it can be shared or reloaded. */
function TabButton({ tab, active, icon: Icon, children }: {
  tab: Tab;
  active: Tab;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  // On a phone the tab strip scrolls sideways: keep the current tab in view (deep links included).
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const el = ref.current;
    const strip = el?.parentElement;
    if (active !== tab || !el || !strip) return;
    // Horizontal only: the page itself must not jump.
    const offset = el.getBoundingClientRect().left - strip.getBoundingClientRect().left;
    strip.scrollTo({ left: strip.scrollLeft + offset - (strip.clientWidth - el.offsetWidth) / 2 });
  }, [active, tab]);
  return (
    <Link
      ref={ref}
      href={tab === "overview" ? "/dashboard" : `/dashboard?tab=${tab}`}
      scroll={false}
      aria-current={active === tab ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 transition-all",
        active === tab
          ? "bg-accent text-white shadow-md shadow-accent/25"
          : "text-fg-secondary hover:bg-surface-2 hover:text-fg"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{children}</span>
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-border-subtle bg-surface-2/30 p-8 text-center text-xs text-fg-secondary">{children}</p>;
}

function LedgerTable({ lines, isCreator }: { lines: LedgerLine[]; isCreator: boolean }) {
  if (lines.length === 0) return <Empty>{t("dashboard.ledger.empty")}</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-fg-muted">
          <tr>
            <th className="py-2 pr-4">{t("dashboard.ledger.date")}</th>
            <th className="py-2 pr-4">{t("dashboard.ledger.type")}</th>
            <th className="py-2 pr-4">{isCreator ? t("dashboard.ledger.from") : t("dashboard.ledger.creator")}</th>
            <th className="py-2 pr-4">{t("dashboard.ledger.gateway")}</th>
            <th className="py-2 text-right">{t("dashboard.ledger.amount")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {lines.map((tx) => (
            <tr key={tx.id} className="text-fg-secondary">
              <td className="py-2.5 pr-4 font-mono text-fg-secondary">{day(tx.createdAt)}</td>
              <td className="py-2.5 pr-4">{tx.entryType.replace(/_/g, " ").toLowerCase()}</td>
              <td className="py-2.5 pr-4">{tx.counterparty}</td>
              <td className="py-2.5 pr-4 text-fg-secondary">{tx.gateway}</td>
              <td className={cn(
                "py-2.5 text-right font-mono font-bold",
                tx.amountCents < 0 ? "text-danger" : "text-success"
              )}>
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
  // The tab lives in the URL (?tab=…), never only in state.
  const activeTab: Tab = (searchParams.get("tab") as Tab) || "overview";
  const [data, setData] = useState<Dashboard | null>(null);
  const [treasury, setTreasury] = useState<Treasury | null>(null);
  const [loadError, setLoadError] = useState(false);


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
    void load();
    if (user.role === "ADMIN") {
      fetch("/api/platform/treasury", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((body: { data: Treasury } | null) => setTreasury(body?.data ?? null))
        .catch(() => setTreasury(null));
    }
  }, [user, load]);

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h2 className="text-2xl font-bold text-fg font-display">{t("dashboard.signedOut.title")}</h2>
        <p className="mt-2 text-sm text-fg-secondary">{t("dashboard.signedOut.body")}</p>
        <Link href="/auth/login" className="mt-6 inline-block rounded-xl bg-accent px-6 py-2.5 text-xs font-bold text-white shadow-lg">
          {t("dashboard.signedOut.cta")}
        </Link>
      </div>
    );
  }

  const isCreator = user.role === "CREATOR";
  const isAdmin = user.role === "ADMIN";
  const spentCents = isCreator ? 0 : (data?.ledger ?? []).reduce((sum, tx) => sum + tx.amountCents, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <ProfileHero
        editable
        displayName={user.displayName}
        username={user.username}
        avatarUrl={user.avatarUrl}
        bannerUrl={user.bannerUrl ?? null}
        roleLabel={isCreator ? t("profile.creator") : undefined}
        actions={
          <>
            {isCreator && (
              <div className="rounded-2xl border border-border-default bg-surface-2/70 px-4 py-2 text-right">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-fg-secondary">{t("profile.balance")}</span>
                <span className="font-mono text-lg font-black text-success">{money(user.balanceCents)}</span>
              </div>
            )}
            <Link
              href={`/@${user.username}`}
              className="inline-flex items-center gap-2 rounded-xl border border-border-default px-4 py-2.5 text-xs font-semibold text-fg transition-colors hover:border-accent/60 hover:bg-accent/10"
            >
              {t("profile.viewPublic")}
            </Link>
            {isCreator && (
              <Link
                href="/creator/upload"
                className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-accent/30 transition-transform hover:scale-[1.03] active:scale-95"
              >
                <Upload className="h-4 w-4" /> {t("profile.upload")}
              </Link>
            )}
          </>
        }
      />

      <div className="flex overflow-x-auto space-x-2 border-b border-border-subtle pb-3 mb-8 text-xs font-semibold">
        <TabButton tab="overview" active={activeTab} icon={LayoutDashboard}>{t("dashboard.tabs.overview")}</TabButton>
        <TabButton tab="library" active={activeTab} icon={Film}>
          {t("dashboard.tabs.library", { count: data?.library.length ?? 0 })}
        </TabButton>
        <TabButton tab="ledger" active={activeTab} icon={Wallet}>{t("dashboard.tabs.ledger")}</TabButton>
        {isCreator && (
          <TabButton tab="uploads" active={activeTab} icon={Clapperboard}>
            {t("dashboard.tabs.uploads", { count: data?.uploads.length ?? 0 })}
          </TabButton>
        )}
        {isCreator && (
          <Link href="/earnings" className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-fg-secondary hover:text-fg hover:bg-surface-2 transition-all">
            <CreditCard className="h-3.5 w-3.5 text-success" />
            <span>{t("dashboard.tabs.earnings")}</span>
          </Link>
        )}
        <TabButton tab="network" active={activeTab} icon={Users}>{t("dashboard.tabs.network")}</TabButton>
        <TabButton tab="playlists" active={activeTab} icon={ListVideo}>{t("dashboard.tabs.playlists")}</TabButton>
        <TabButton tab="lists" active={activeTab} icon={ListChecks}>{t("dashboard.tabs.lists")}</TabButton>
        <TabButton tab="invitations" active={activeTab} icon={Sparkles}>{t("dashboard.tabs.invitations")}</TabButton>
        {isAdmin && <TabButton tab="treasury" active={activeTab} icon={Shield}>{t("dashboard.tabs.treasury")}</TabButton>}
        <TabButton tab="settings" active={activeTab} icon={Settings}>{t("dashboard.tabs.settings")}</TabButton>
      </div>

      {loadError && <Empty>{t("dashboard.loadError")}</Empty>}

      {activeTab === "overview" && data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-panel rounded-2xl p-5">
            <span className="text-[11px] font-mono uppercase text-fg-secondary">{isCreator ? t("dashboard.stats.available") : t("dashboard.stats.spent")}</span>
            <p className="mt-2 text-2xl font-black text-fg font-mono">{money(isCreator ? user.balanceCents : spentCents)}</p>
            <span className="text-[11px] text-fg-muted mt-1 block">{t("dashboard.stats.fromLedger")}</span>
          </div>
          <div className="glass-panel rounded-2xl p-5">
            <span className="text-[11px] font-mono uppercase text-fg-secondary">{isCreator ? t("dashboard.stats.published") : t("dashboard.stats.unlocked")}</span>
            <p className="mt-2 text-2xl font-black text-fg font-mono">{isCreator ? data.uploads.length : data.library.length}</p>
          </div>
          <div className="glass-panel rounded-2xl p-5">
            <span className="text-[11px] font-mono uppercase text-fg-secondary">{isCreator ? t("dashboard.stats.pendingPayouts") : t("dashboard.stats.transactions")}</span>
            <p className="mt-2 text-2xl font-black text-fg font-mono">
              {isCreator ? money(data.pendingPayoutCents) : data.ledger.length}
            </p>
          </div>
        </div>
      )}

      {activeTab === "library" && data && (
        data.library.length === 0 ? (
          <Empty>{t("dashboard.libraryEmpty")}</Empty>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.library.map((video) => (
              <Link key={video.id} href={`/watch/${video.id}`} className="glass-panel rounded-2xl overflow-hidden group">
                <div className="aspect-video bg-surface-3 overflow-hidden">
                  {video.thumbnailUrl && (
                    <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                  )}
                </div>
                <div className="p-4">
                  <h4 className="text-sm font-bold text-fg line-clamp-1">{video.title}</h4>
                  <p className="text-xs text-fg-secondary">{video.creatorName}</p>
                  <p className="mt-2 text-[11px] font-mono text-fg-muted">
                    {duration(video.durationSeconds)} • {t("dashboard.unlockedOn", { date: day(video.unlockedAt) })} • {money(video.amountPaidCents)}
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
      {activeTab === "invitations" && <InvitationsPanel />}

      {activeTab === "treasury" && isAdmin && (
        treasury ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              [t("dashboard.treasury.gross"), money(treasury.grossCents), t("dashboard.treasury.grossHint", { count: treasury.creditsCount })],
              [t("dashboard.treasury.fees"), money(treasury.platformFeeCents), t("dashboard.treasury.feesHint", { percent: treasury.protocolRakePercent })],
              [t("dashboard.treasury.creators"), money(treasury.creatorNetCents), t("dashboard.treasury.creatorsHint")],
              [t("dashboard.treasury.requested"), money(treasury.payoutsRequestedCents), t("dashboard.treasury.requestedHint")],
              [t("dashboard.treasury.settled"), money(treasury.payoutsSettledCents), t("dashboard.treasury.settledHint")],
            ].map(([label, value, hint]) => (
              <div key={label} className="glass-panel rounded-2xl p-5">
                <span className="text-[11px] font-mono uppercase text-fg-secondary">{label}</span>
                <p className="mt-2 text-2xl font-black text-success font-mono">{value}</p>
                <span className="text-[11px] text-fg-muted">{hint}</span>
              </div>
            ))}
          </div>
        ) : (
          <Empty>{t("dashboard.treasury.unavailable")}</Empty>
        )
      )}

      {activeTab === "settings" && <ProfileSettingsPanel isCreator={isCreator} />}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-24 text-center text-xs text-fg-muted font-mono">{t("common.loading")}</div>}>
      <DashboardContent />
    </Suspense>
  );
}
