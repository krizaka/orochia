"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { LogOut, MailCheck, RefreshCw } from "lucide-react";
import { Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { Rich } from "@/components/Rich";

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
      setMessage(data.error ?? t("verifyGate.sendFailed"));
      return;
    }
    setDevLink(data.devVerificationUrl ?? null);
    setState("sent");
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 text-accent">
        <MailCheck className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-black text-fg font-display">{t("verifyGate.title")}</h1>
      <p className="mt-3 text-sm leading-relaxed text-fg-secondary">
        <Rich text={t("verifyGate.body")} slots={{ email: <strong className="break-all text-fg">{user.email}</strong> }} />
      </p>

      <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          onClick={resend}
          disabled={state === "sending" || state === "sent"}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {state === "sending" ? <Spinner size="sm" className="text-current" /> : <RefreshCw className="h-4 w-4" />}
          {state === "sent" ? t("verifyGate.sent") : t("verifyGate.resend")}
        </button>
        <button
          onClick={() => void refresh()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-default px-5 py-3 text-sm font-semibold text-fg hover:bg-white/5"
        >
          {t("verifyGate.done")}
        </button>
      </div>
      {message && <p role="alert" className="mt-4 text-xs text-danger">{message}</p>}
      {devLink && (
        <p className="mt-4 break-all text-[11px] text-fg-muted">
          {t("verifyGate.demo")} <a href={devLink} className="text-accent underline">{devLink}</a>
        </p>
      )}
      <p className="mt-6 text-xs text-fg-muted">{t("verifyGate.spam")}</p>
      <button onClick={() => void logout()} className="mt-8 inline-flex items-center gap-1.5 text-xs text-fg-secondary hover:text-fg">
        <LogOut className="h-3.5 w-3.5" /> {t("verifyGate.signOut")}
      </button>
    </div>
  );
}
