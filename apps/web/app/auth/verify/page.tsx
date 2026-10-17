"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { OrochiaLogo, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { NEXT_AFTER_VERIFY_KEY, safeNext } from "@/lib/creator-journey";
import { t } from "@/lib/i18n";

/** The link e-mailed at registration: /auth/verify?token=… confirms the address once. */
export default function VerifyEmailPage() {
  const { refresh } = useAuth();
  const [state, setState] = useState<"working" | "done" | "failed">("working");
  const [error, setError] = useState<string | null>(null);
  // Where the sign-up form was going (e.g. the creator application), read once; the dashboard otherwise.
  const [next, setNext] = useState("/me");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    fetch("/api/auth/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (res) => {
        if (res.ok) {
          try {
            const kept = safeNext(localStorage.getItem(NEXT_AFTER_VERIFY_KEY));
            localStorage.removeItem(NEXT_AFTER_VERIFY_KEY);
            if (kept) setNext(kept);
          } catch {
            // Storage refused: the dashboard.
          }
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
      <OrochiaLogo size={64} className="mb-6" />
      {state === "working" && <Spinner size="lg" label={t("auth.verify.working")} />}
      {state === "done" && (
        <>
          <CheckCircle2 className="h-12 w-12 text-fg-success" />
          <h1 className="mt-4 text-2xl font-black text-fg font-display">{t("auth.verify.done")}</h1>
          <p className="mt-2 text-sm text-fg-secondary">{t("auth.verify.doneBody")}</p>
          <Link href={next} className="mt-6 rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-white">
            {t("auth.verify.continue")}
          </Link>
        </>
      )}
      {state === "failed" && (
        <>
          <XCircle className="h-12 w-12 text-fg-danger" />
          <h1 className="mt-4 text-2xl font-black text-fg font-display">{t("auth.verify.failed")}</h1>
          <p className="mt-2 text-sm text-fg-secondary">{error}</p>
          <Link href="/" className="mt-6 rounded-xl border border-border-default px-6 py-2.5 text-sm font-semibold text-fg">
            {t("auth.verify.newLink")}
          </Link>
        </>
      )}
    </div>
  );
}
