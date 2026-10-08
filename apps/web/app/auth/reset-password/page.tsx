"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Lock } from "lucide-react";

/** The link e-mailed by "forgot password": /auth/reset-password?token=… sets a new password once. */
export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 10) return setError("At least 10 characters.");
    if (password !== confirm) return setError("The two passwords differ.");
    setState("saving");
    setError(null);
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    const res = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "The password could not be changed.");
      setState("idle");
      return;
    }
    setState("done");
  };

  const field = "w-full rounded-xl border border-white/10 bg-zinc-900 py-2.5 pl-10 pr-4 text-sm text-white focus:border-violet-500 focus:outline-none light:bg-slate-50 light:border-black/10 light:text-slate-900";

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 sm:p-8 light:bg-white light:border-black/10">
        {state === "done" ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            <h1 className="mt-4 text-2xl font-black text-white font-display light:text-slate-900">Password changed</h1>
            <p className="mt-2 text-sm text-zinc-400 light:text-slate-500">Sign in with your new password.</p>
            <Link href="/auth/login" className="mt-6 inline-block rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white">
              Sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-black text-white font-display light:text-slate-900">Choose a new password</h1>
            <form onSubmit={submit} className="mt-5 space-y-4">
              {[
                { value: password, set: setPassword, label: "New password" },
                { value: confirm, set: setConfirm, label: "Confirm it" },
              ].map((f) => (
                <label key={f.label} className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 light:text-slate-500">
                  {f.label}
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500 light:text-slate-500" />
                    <input type="password" required minLength={10} autoComplete="new-password" value={f.value} onChange={(e) => f.set(e.target.value)} className={field} />
                  </div>
                </label>
              ))}
              {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
              <button disabled={state === "saving"} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-bold text-white disabled:opacity-60">
                {state === "saving" && <Loader2 className="h-4 w-4 animate-spin" />} Save the new password
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
