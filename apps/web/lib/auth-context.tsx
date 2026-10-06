"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: "CREATOR" | "MEMBER" | "ADMIN";
  avatarUrl: string;
  bio?: string;
  balanceCents: number;
  unlockedVideosCount: number;
  followingCount: number;
  isAgeVerified: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  login: (email: string, role?: "CREATOR" | "MEMBER") => Promise<void>;
  register: (data: {
    username: string;
    email: string;
    displayName: string;
    role: "CREATOR" | "MEMBER";
    isAgeVerified: boolean;
  }) => Promise<void>;
  logout: () => Promise<void>;
  switchProfile: (profileType: "creator" | "patron" | "guest") => Promise<void>;
}

// Preset demo accounts for rapid testing & production preview
export const DEMO_PROFILES: Record<"creator" | "patron", UserProfile> = {
  creator: {
    id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    username: "elenavox",
    displayName: "Elena Vox",
    email: "elena@orochia.org",
    role: "CREATOR",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    bio: "Visual artist, nocturnal producer & independent 4K cinema director. Supported 100% directly by sovereign patrons.",
    balanceCents: 48250, // $482.50
    unlockedVideosCount: 14,
    followingCount: 28,
    isAgeVerified: true,
  },
  patron: {
    id: "f9e8d7c6-b5a4-3210-9876-543210fedcba",
    username: "alex_vance",
    displayName: "Alex Vance",
    email: "alex@sanctuary.io",
    role: "MEMBER",
    avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80",
    bio: "Patron of independent creator cinema & electronic music. VIP Sanctuary Supporter.",
    balanceCents: 15000, // $150.00 tip credit balance
    unlockedVideosCount: 8,
    followingCount: 12,
    isAgeVerified: true,
  },
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  switchProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from API or localStorage
  useEffect(() => {
    const initAuth = async () => {
      try {
        const stored = localStorage.getItem("orochia_user_session");
        if (stored) {
          setUser(JSON.parse(stored));
        } else {
          // Default to logged-in creator for instant rich demonstration
          setUser(DEMO_PROFILES.creator);
          localStorage.setItem("orochia_user_session", JSON.stringify(DEMO_PROFILES.creator));
        }
      } catch (e) {
        console.error("Auth init error:", e);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, role: "CREATOR" | "MEMBER" = "CREATOR") => {
    setIsLoading(true);
    try {
      const selected = role === "CREATOR" ? DEMO_PROFILES.creator : DEMO_PROFILES.patron;
      const updatedUser = { ...selected, email };
      setUser(updatedUser);
      localStorage.setItem("orochia_user_session", JSON.stringify(updatedUser));
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedUser),
      }).catch(() => {});
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: {
    username: string;
    email: string;
    displayName: string;
    role: "CREATOR" | "MEMBER";
    isAgeVerified: boolean;
  }) => {
    setIsLoading(true);
    try {
      const newUser: UserProfile = {
        id: `user-${Date.now()}`,
        username: data.username.toLowerCase(),
        displayName: data.displayName,
        email: data.email,
        role: data.role,
        avatarUrl:
          data.role === "CREATOR"
            ? "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
            : "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80",
        bio: data.role === "CREATOR" ? "New Sovereign Creator on Orochia." : "Sanctuary Patron.",
        balanceCents: 0,
        unlockedVideosCount: 0,
        followingCount: 0,
        isAgeVerified: data.isAgeVerified,
      };

      setUser(newUser);
      localStorage.setItem("orochia_user_session", JSON.stringify(newUser));
      await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      }).catch(() => {});
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem("orochia_user_session");
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  };

  const switchProfile = async (profileType: "creator" | "patron" | "guest") => {
    if (profileType === "guest") {
      await logout();
      return;
    }
    const profile = DEMO_PROFILES[profileType];
    setUser(profile);
    localStorage.setItem("orochia_user_session", JSON.stringify(profile));
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    }).catch(() => {});
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        switchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
