"use client";

import React from "react";

import { LedgerTable } from "@/components/me/LedgerTable";
import { useMeData } from "@/components/me/MeData";
import { Skeleton } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";

export default function MeTransactions() {
  const { user } = useAuth();
  const { data } = useMeData();
  if (!data || !user) return <Skeleton shape="rect" className="h-48 rounded-2xl" />;
  return <LedgerTable lines={data.ledger} isCreator={user.role === "CREATOR"} />;
}
