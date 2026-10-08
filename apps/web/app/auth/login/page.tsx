"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LogIn, Lock, Mail, ArrowRight, Sparkles } from "lucide-react";
import { OrochiaLogo } from "@/components/OrochiaLogo";

export default function LoginPage() {
  const router = useRouter();
  const { login, switchProfile, demoMode } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await login(email, password);
      // Back where the visitor was sent from (?next=/creator/upload) — same-site paths only.
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next && /^\/(?!\/)/.test(next) ? next : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center justify-center px-4 py-12">
      <div className="w-full overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 p-8 shadow-2xl relative light:bg-white light:border-black/10">
        {/* Ambient Top Glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-40 w-40 rounded-full bg-violet-600/30 blur-3xl pointer-events-none" />

        <div className="text-center mb-8">
          <OrochiaLogo size={72} className="mx-auto mb-3" />
          <h1 className="text-2xl font-black text-white font-display light:text-slate-900">Enter the Sanctuary</h1>
          <p className="mt-1 text-xs text-zinc-400 light:text-slate-500">
            Sign in to your sovereign creator or patron account
          </p>
        </div>

        {/* Demo accounts — only in demo mode (never in production) */}
        {demoMode && (
        <div className="mb-6 rounded-2xl border border-violet-500/20 bg-violet-950/20 p-3.5">
          <p className="text-[11px] font-semibold text-violet-300 mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" />
            <span>Instant Demo Access</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={async () => {
                await switchProfile("creator");
                router.push("/dashboard");
              }}
              className="rounded-xl border border-violet-500/30 bg-violet-600/20 py-2 px-3 text-xs font-bold text-white hover:bg-violet-600/40 transition-colors"
            >
              Sign In as Creator
            </button>
            <button
              type="button"
              onClick={async () => {
                await switchProfile("patron");
                router.push("/dashboard");
              }}
              className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-600/20 py-2 px-3 text-xs font-bold text-white hover:bg-fuchsia-600/40 transition-colors"
            >
              Sign In as Patron
            </button>
          </div>
        </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block light:text-slate-500">
              Email or Username
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500 light:text-slate-500" />
              <input
                type="text"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="creator@orochia.org"
                className="w-full rounded-xl border border-white/10 bg-zinc-900 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none light:bg-slate-50 light:border-black/10 light:placeholder:text-slate-400 light:text-slate-900"
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-zinc-400 light:text-slate-500">
                Password
              </label>
              <Link href="/auth/forgot-password" className="text-xs text-violet-300 hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500 light:text-slate-500" />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-white/10 bg-zinc-900 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none light:bg-slate-50 light:border-black/10 light:placeholder:text-slate-400 light:text-slate-900"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/30 px-3.5 py-2.5 text-xs text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold text-sm shadow-lg shadow-violet-600/25 transition-all flex items-center justify-center gap-2 mt-6"
          >
            <LogIn className="h-4 w-4" />
            <span>{isLoading ? "Signing In..." : "Sign In to Account"}</span>
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-400 light:text-slate-500">
          New to the platform?{" "}
          <Link href="/auth/register" className="font-semibold text-violet-400 hover:underline">
            Register for Sanctuary
          </Link>
        </p>
      </div>
    </div>
  );
}
