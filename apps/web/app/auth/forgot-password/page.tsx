"use client";

import React, { useState } from "react";
import Link from "next/link";
import { KeyRound, Loader2, Mail } from "lucide-react";

/** Asks for a password-reset link. The answer never says whether the address has an account. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    setError(null);
    const res = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const data = (await res.json().catch(() => ({}))) as { error?: string; devResetUrl?: string };
    if (!res.ok) {
      setError(data.error ?? "The request could not be sent. Try again.");
      setState("idle");
      return;
    }
    setDevLink(data.devResetUrl ?? null);
    setState("sent");
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 sm:p-8 light:bg-white light:border-black/10">
        <KeyRound className="h-8 w-8 text-violet-400" />
        <h1 className="mt-4 text-2xl font-black text-white font-display light:text-slate-900">Forgot your password?</h1>
        {state === "sent" ? (
          <>
            <p className="mt-3 text-sm text-zinc-400 light:text-slate-500">
              If an account uses <strong className="break-all text-zinc-200 light:text-slate-700">{email}</strong>, a reset link is on its way. It works once, for one hour.
            </p>
            {devLink && (
              <p className="mt-4 break-all text-[11px] text-zinc-500 light:text-slate-500">
                Demo mode: <a href={devLink} className="text-violet-300 underline">{devLink}</a>
              </p>
            )}
          </>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 light:text-slate-500">
              E-mail
              <div className="relative mt-1.5">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500 light:text-slate-500" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 py-2.5 pl-10 pr-4 text-sm normal-case tracking-normal text-white focus:border-violet-500 focus:outline-none light:bg-slate-50 light:border-black/10 light:text-slate-900"
                />
              </div>
            </label>
            {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
            <button disabled={state === "sending"} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-bold text-white disabled:opacity-60">
              {state === "sending" && <Loader2 className="h-4 w-4 animate-spin" />} Send the reset link
            </button>
          </form>
        )}
        <Link href="/auth/login" className="mt-6 inline-block text-xs text-zinc-400 hover:text-white light:text-slate-500 light:hover:text-slate-950">
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
