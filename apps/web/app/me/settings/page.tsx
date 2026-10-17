"use client";

import React from "react";

import { ProfileSettingsPanel } from "@/components/dashboard/ProfileSettingsPanel";
import { useAuth } from "@/lib/auth-context";

export default function MeSettings() {
  const { user } = useAuth();
  return user ? <ProfileSettingsPanel isCreator={user.role === "CREATOR"} /> : null;
}
