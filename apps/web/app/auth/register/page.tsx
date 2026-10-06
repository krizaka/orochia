"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Flame, UserPlus, Lock, Mail, User, ShieldCheck } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"CREATOR" | "MEMBER">("CREATOR");
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isAgeVerified) {
      setError("You must certify that you are at least 18 years of age.");
      return;
    }
    if (!acceptTerms) {
      setError("You must accept the Terms of Service and 2257 Record-Keeping Covenant.");
      return;
    }

    setIsLoading(true);
    try {
      await register({
        username,
        displayName: displayName || username,
        email,
        role,
        isAgeVerified,
      });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-lg items-center justify-center px-4 py-12">
      <div className="w-full overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 p-8 shadow-2xl relative">
        {/* Ambient Top Glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-44 w-44 rounded-full bg-fuchsia-600/25 blur-3xl pointer-events-none" />

        <div className="text-center mb-6">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 via-fuchsia-600 to-pink-500 shadow-lg shadow-violet-600/25">
            <Flame className="h-6 w-6 text-white fill-white" />
          </div>
          <h1 className="text-2xl font-black text-white font-display">Join the Sanctuary</h1>
          <p className="mt-1 text-xs text-zinc-400">
            Create your sovereign creator or patron identity
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="handle"
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
                Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Stage / Public Name"
                className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="creator@orochia.org"
                className="w-full rounded-xl border border-white/10 bg-zinc-900 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-white/10 bg-zinc-900 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Account Intent / Role */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
              Membership Intent
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("CREATOR")}
                className={`rounded-xl p-3 text-left border transition-all ${
                  role === "CREATOR"
                    ? "border-violet-500 bg-violet-600/20 text-white"
                    : "border-white/10 bg-zinc-900 text-zinc-400 hover:text-white"
                }`}
              >
                <p className="text-xs font-bold">Sovereign Creator</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">Upload 4K media & receive tips</p>
              </button>

              <button
                type="button"
                onClick={() => setRole("MEMBER")}
                className={`rounded-xl p-3 text-left border transition-all ${
                  role === "MEMBER"
                    ? "border-fuchsia-500 bg-fuchsia-600/20 text-white"
                    : "border-white/10 bg-zinc-900 text-zinc-400 hover:text-white"
                }`}
              >
                <p className="text-xs font-bold">Sanctuary Patron</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">Watch, tip & unlock exclusive feeds</p>
              </button>
            </div>
          </div>

          {/* Mandatory Legal Declarations */}
          <div className="space-y-2.5 pt-2 border-t border-white/5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={isAgeVerified}
                onChange={(e) => setIsAgeVerified(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-xs text-zinc-400">
                I certify under penalty of perjury that I am at least <strong className="text-white">18 years of age</strong>.
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-xs text-zinc-400">
                I accept the{" "}
                <Link href="/legal/terms" target="_blank" className="text-violet-400 underline">
                  Terms of Service
                </Link>{" "}
                and acknowledge the{" "}
                <Link href="/legal/2257" target="_blank" className="text-violet-400 underline">
                  18 U.S.C. § 2257 Notice
                </Link>.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-sm shadow-xl shadow-fuchsia-600/25 transition-all flex items-center justify-center gap-2 mt-4"
          >
            <UserPlus className="h-4 w-4" />
            <span>{isLoading ? "Creating Account..." : "Create Sanctuary Account"}</span>
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-400">
          Already registered?{" "}
          <Link href="/auth/login" className="font-semibold text-violet-400 hover:underline">
            Sign In here
          </Link>
        </p>
      </div>
    </div>
  );
}
