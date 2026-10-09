"use client";

import React, { useState } from "react";
import Link from "next/link";
import { KeyRound, Mail } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { t } from "@/lib/i18n";
import { Rich } from "@/components/Rich";

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
      setError(data.error ?? t("auth.forgot.failed"));
      setState("idle");
      return;
    }
    setDevLink(data.devResetUrl ?? null);
    setState("sent");
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-3xl border border-border-default bg-surface-1 p-6 sm:p-8">
        <KeyRound className="h-8 w-8 text-accent" />
        <h1 className="mt-4 text-2xl font-black text-fg font-display">{t("auth.forgot.title")}</h1>
        {state === "sent" ? (
          <>
            <p className="mt-3 text-sm text-fg-secondary">
              <Rich text={t("auth.forgot.sent")} slots={{ email: <strong className="break-all text-fg">{email}</strong> }} />
            </p>
            {devLink && (
              <p className="mt-4 break-all text-[11px] text-fg-muted">
                {t("auth.forgot.demo")} <a href={devLink} className="text-accent underline">{devLink}</a>
              </p>
            )}
          </>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-fg-secondary">
              {t("auth.forgot.email")}
              <div className="relative mt-1.5">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-fg-muted" aria-hidden />
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl pl-10 normal-case tracking-normal"
                />
              </div>
            </label>
            {error && <p role="alert" className="text-xs text-danger">{error}</p>}
            <Button type="submit" variant="primary" size="lg" shape="rounded" loading={state === "sending"} className="w-full rounded-xl font-bold">
              {t("auth.forgot.submit")}
            </Button>
          </form>
        )}
        <Link href="/auth/login" className="mt-6 inline-block text-xs text-fg-secondary hover:text-fg">
          {t("auth.forgot.back")}
        </Link>
      </div>
    </div>
  );
}
