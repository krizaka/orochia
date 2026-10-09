"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Lock } from "lucide-react";
import { Button, buttonVariants, Input } from "@/components/ui";
import { t } from "@/lib/i18n";

/** The link e-mailed by "forgot password": /auth/reset-password?token=… sets a new password once. */
export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 10) return setError(t("auth.reset.tooShort"));
    if (password !== confirm) return setError(t("auth.reset.differ"));
    setState("saving");
    setError(null);
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    const res = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? t("auth.reset.failed"));
      setState("idle");
      return;
    }
    setState("done");
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-3xl border border-border-default bg-surface-1 p-6 sm:p-8">
        {state === "done" ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
            <h1 className="mt-4 text-2xl font-black text-fg font-display">{t("auth.reset.done")}</h1>
            <p className="mt-2 text-sm text-fg-secondary">{t("auth.reset.doneBody")}</p>
            <Link href="/auth/login" className={buttonVariants({ variant: "primary", shape: "rounded", className: "mt-6 rounded-xl px-6 font-bold" })}>
              {t("auth.reset.signIn")}
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-black text-fg font-display">{t("auth.reset.title")}</h1>
            <form onSubmit={submit} className="mt-5 space-y-4">
              {[
                { value: password, set: setPassword, label: t("auth.reset.password") },
                { value: confirm, set: setConfirm, label: t("auth.reset.confirm") },
              ].map((f) => (
                <label key={f.label} className="block text-xs font-semibold uppercase tracking-wider text-fg-secondary">
                  {f.label}
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-fg-muted" aria-hidden />
                    <Input type="password" required minLength={10} autoComplete="new-password" value={f.value} onChange={(e) => f.set(e.target.value)} className="rounded-xl pl-10" />
                  </div>
                </label>
              ))}
              {error && <p role="alert" className="text-xs text-danger">{error}</p>}
              <Button type="submit" variant="primary" size="lg" shape="rounded" loading={state === "saving"} className="w-full rounded-xl font-bold">
                {t("auth.reset.submit")}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
