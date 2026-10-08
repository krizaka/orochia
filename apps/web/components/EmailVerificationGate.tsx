"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2, LogOut, MailCheck, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

/** Pages an unverified account may still open: the verification link itself, password reset, legal. */
const OPEN_PATHS = ["/auth/verify", "/auth/reset-password", "/auth/forgot-password", "/legal"];

/**
 * An account whose e-mail is not verified sees this page and nothing else: the address it must
 * confirm, a way to get the link again, and a way to sign out. The API refuses everything else too
 * (requireUserWithRole), so this is the interface of a rule, not the rule.
 */
export function EmailVerificationGate({ children }: { children: React.ReactNode }) {
  const { user, logout, refresh } = useAuth();
  const pathname = usePathname();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  if (!user || user.emailVerified || OPEN_PATHS.some((p) => pathname.startsWith(p))) return <>{children}</>;

  const resend = async () => {
    setState("sending");
    setMessage(null);
    const res = await fetch("/api/auth/resend-verification", { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { error?: string; alreadyVerified?: boolean; devVerificationUrl?: string };
    if (data.alreadyVerified) return void refresh();
    if (!res.ok) {
      setState("error");
      setMessage(data.error ?? "The link could not be sent. Try again in a moment.");
      return;
    }
    setDevLink(data.devVerificationUrl ?? null);
    setState("sent");
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600/15 text-violet-300">
        <MailCheck className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-black text-white font-display">Verify your e-mail</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        We sent a confirmation link to <strong className="break-all text-zinc-200">{user.email}</strong>. Open it to start using
        Orochia — until then your account can only sign in.
      </p>

      <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          onClick={resend}
          disabled={state === "sending" || state === "sent"}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-violet-500 disabled:opacity-60"
        >
          {state === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {state === "sent" ? "Link sent — check your inbox" : "Send the link again"}
        </button>
        <button
          onClick={() => void refresh()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-zinc-200 hover:bg-white/5"
        >
          I&apos;ve verified it
        </button>
      </div>
      {message && <p role="alert" className="mt-4 text-xs text-rose-300">{message}</p>}
      {devLink && (
        <p className="mt-4 break-all text-[11px] text-zinc-500">
          Demo mode: <a href={devLink} className="text-violet-300 underline">{devLink}</a>
        </p>
      )}
      <p className="mt-6 text-xs text-zinc-500">Check your spam folder. The link works once, for 48 hours.</p>
      <button onClick={() => void logout()} className="mt-8 inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white">
        <LogOut className="h-3.5 w-3.5" /> Sign out
      </button>
    </div>
  );
}
