"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { StudioVideo } from "@/components/dashboard/VideoManager";
import { useAuth } from "@/lib/auth-context";

export interface LibraryEntry {
  id: string;
  title: string;
  creatorName: string;
  durationSeconds: number;
  unlockedAt: string;
  amountPaidCents: number;
  thumbnailUrl: string | null;
}

export interface LedgerLine {
  id: string;
  createdAt: string;
  entryType: string;
  counterparty: string;
  amountCents: number;
  gateway: string;
}

export interface MeDashboard {
  library: LibraryEntry[];
  ledger: LedgerLine[];
  uploads: StudioVideo[];
  pendingPayoutCents: number;
}

export interface Treasury {
  protocolRakePercent: number;
  grossCents: number;
  platformFeeCents: number;
  creatorNetCents: number;
  creditsCount: number;
  payoutsRequestedCents: number;
  payoutsSettledCents: number;
}

interface MeDataValue {
  data: MeDashboard | null;
  treasury: Treasury | null;
  loadError: boolean;
  reload: () => Promise<void>;
}

const Context = createContext<MeDataValue>({ data: null, treasury: null, loadError: false, reload: async () => undefined });

/** The private dashboard's read model, fetched once for every /me view (they share the layout, so the data survives navigation). */
export function MeDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState<MeDashboard | null>(null);
  const [treasury, setTreasury] = useState<Treasury | null>(null);
  const [loadError, setLoadError] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/me/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setData(((await res.json()) as { data: MeDashboard }).data);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  const userId = user?.id;
  const isAdmin = user?.role === "ADMIN";
  useEffect(() => {
    if (!userId) return;
    void reload();
    if (isAdmin) {
      fetch("/api/platform/treasury", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((body: { data: Treasury } | null) => setTreasury(body?.data ?? null))
        .catch(() => setTreasury(null));
    }
  }, [userId, isAdmin, reload]);

  const value = useMemo(() => ({ data, treasury, loadError, reload }), [data, treasury, loadError, reload]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useMeData = () => useContext(Context);
