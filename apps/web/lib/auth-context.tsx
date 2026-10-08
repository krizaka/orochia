"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export const AVATAR_PLACEHOLDER = "/avatar-placeholder.svg";

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: "CREATOR" | "MEMBER" | "ADMIN";
  avatarUrl: string;
  bannerUrl?: string | null;
  bio?: string | null;
  payoutAddressCrypto?: string | null;
  balanceCents: number;
  unlockedVideosCount: number;
  isAgeVerified: boolean;
  /** False until the address is confirmed: the app then shows only the "verify your e-mail" page. */
  emailVerified: boolean;
}

export interface RegisterInput {
  username: string;
  email: string;
  displayName: string;
  password: string;
  /** YYYY-MM-DD, 18+ (checked by the server). */
  dateOfBirth: string;
  isAgeVerified: boolean;
  acceptTerms: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  /** Seeded showcase accounts can be switched to (never in production). */
  demoMode: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  switchProfile: (profileType: "creator" | "patron" | "guest") => Promise<void>;
}

/** Seeded accounts (packages/db/src/seed.ts) used by the demo switcher. */
const DEMO_CREDENTIALS = {
  creator: { identifier: "elena@orochia.org", password: "elena1234" },
  patron: { identifier: "alex@sanctuary.io", password: "alex1234" },
} as const;

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  demoMode: false,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  refresh: async () => {},
  switchProfile: async () => {},
});

async function postJson(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Request failed");
  }
}

/** Session state, read from the server (httpOnly cookie) — nothing about the user is stored client-side. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await res.json()) as { user: (Omit<UserProfile, "avatarUrl"> & { avatarUrl: string | null }) | null; demoMode?: boolean };
      setDemoMode(Boolean(data.demoMode));
      setUser(data.user ? { ...data.user, avatarUrl: data.user.avatarUrl || AVATAR_PLACEHOLDER } : null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = async (identifier: string, password: string) => {
    await postJson("/api/auth/login", { identifier, password });
    await refresh();
  };

  const register = async (data: RegisterInput) => {
    await postJson("/api/auth/register", data);
    await refresh();
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  };

  const switchProfile = async (profileType: "creator" | "patron" | "guest") => {
    if (profileType === "guest") return logout();
    if (!demoMode) return;
    const { identifier, password } = DEMO_CREDENTIALS[profileType];
    await login(identifier, password);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, demoMode, login, register, logout, refresh, switchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
