"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";

/** The link e-mailed at registration: /auth/verify?token=… confirms the address once. */
export default function VerifyEmailPage() {
  const { refresh } = useAuth();
  const [state, setState] = useState<"working" | "done" | "failed">("working");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    fetch("/api/auth/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (res) => {
        if (res.ok) {
          setState("done");
          await refresh();
        } else {
          setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? t("auth.verify.invalid"));
          setState("failed");
        }
      })
      .catch(() => {
        setError(t("auth.verify.unreachable"));
        setState("failed");
      });
  }, [refresh]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      {state === "working" && <Loader2 className="h-10 w-10 animate-spin text-violet-400" aria-label={t("auth.verify.working")} />}
      {state === "done" && (
        <>
          <CheckCircle2 className="h-12 w-12 text-emerald-400" />
          <h1 className="mt-4 text-2xl font-black text-white font-display light:text-slate-900">{t("auth.verify.done")}</h1>
          <p className="mt-2 text-sm text-zinc-400 light:text-slate-500">{t("auth.verify.doneBody")}</p>
          <Link href="/dashboard" className="mt-6 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white">
            {t("auth.verify.continue")}
          </Link>
        </>
      )}
      {state === "failed" && (
        <>
          <XCircle className="h-12 w-12 text-rose-400" />
          <h1 className="mt-4 text-2xl font-black text-white font-display light:text-slate-900">{t("auth.verify.failed")}</h1>
          <p className="mt-2 text-sm text-zinc-400 light:text-slate-500">{error}</p>
          <Link href="/" className="mt-6 rounded-xl border border-white/10 px-6 py-2.5 text-sm font-semibold text-zinc-200 light:border-black/10 light:text-slate-700">
            {t("auth.verify.newLink")}
          </Link>
        </>
      )}
    </div>
  );
}
