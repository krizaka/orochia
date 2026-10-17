"use client";

import React from "react";

import { NetworkPanel } from "@/components/dashboard/NetworkPanel";
import { useAuth } from "@/lib/auth-context";

export default function MeNetwork() {
  const { user } = useAuth();
  return user ? <NetworkPanel isCreator={user.role === "CREATOR"} /> : null;
}
