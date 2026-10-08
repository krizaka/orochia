"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Rich } from "@/components/Rich";
import { t } from "@/lib/i18n";
import { BirthDateField, isAdultBirthDate } from "@/components/BirthDateField";
import { UsernameField } from "@/components/UsernameField";

interface Pending {
  provider: "google" | "facebook";
  email: string | null;
  needsEmail: boolean;
  displayName: string;
  username: string;
  avatarUrl: string | null;
}

const label = "block text-xs font-semibold uppercase tracking-wider text-zinc-400 light:text-slate-500";
const field =
  "mt-1.5 w-full rounded-xl border border-white/10 light:border-black/10 bg-zinc-900 light:bg-slate-50 px-3.5 py-2.5 text-sm normal-case tracking-normal text-white light:text-slate-900 focus:border-violet-500 focus:outline-none";

/** After a first Google / Facebook sign-in: username, display name, 18+ certification and terms, then the account. */
export default function CompleteSignUpPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [pending, setPending] = useState<Pending | null | "expired">(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/oauth/pending", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) return setPending("expired");
        const data = (await r.json()) as Pending;
        setPending(data);
        setUsername(data.username);
        setDisplayName(data.displayName);
      })
      .catch(() => setPending("expired"));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdultBirthDate(dateOfBirth)) return setError(t("auth.register.errors.birthDate"));
    if (!isAgeVerified) return setError(t("auth.register.errors.age"));
    if (!acceptTerms) return setError(t("auth.register.errors.terms"));
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/oauth/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, displayName, email: email || null, dateOfBirth, isAgeVerified, acceptTerms }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; next?: string; details?: { fieldErrors?: Record<string, string[]> } };
    setBusy(false);
    if (!res.ok) return setError(Object.values(data.details?.fieldErrors ?? {})[0]?.[0] ?? data.error ?? t("auth.register.errors.failed"));
    await refresh();
    router.push(data.next ?? "/");
  };

  if (pending === null) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>;
  if (pending === "expired") {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-sm text-zinc-400 light:text-slate-600">{t("auth.complete.expired")}</p>
        <Link href="/auth/login" className="mt-6 inline-block rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white">{t("auth.complete.restart")}</Link>
      </div>
    );
  }

  const providerName = t(`auth.complete.providers.${pending.provider}`);
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <form onSubmit={submit} className="space-y-4 rounded-3xl border border-white/10 light:border-black/5 bg-zinc-950 light:bg-white p-6 shadow-2xl sm:p-8">
        <div className="text-center">
          {pending.avatarUrl && <img src={pending.avatarUrl} alt="" className="mx-auto mb-3 h-16 w-16 rounded-full object-cover" />}
          <h1 className="font-display text-2xl font-black text-white light:text-slate-900">{t("auth.complete.title")}</h1>
          <p className="mt-1.5 text-sm text-zinc-400 light:text-slate-500">{t("auth.complete.subtitle", { provider: providerName })}</p>
        </div>
        {error && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">{error}</p>}
        <UsernameField value={username} onChange={setUsername} labelClass={label} fieldClass={field} />
        <label className={label}>
          {t("auth.register.displayName")}
          <input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={field} />
        </label>
        {pending.needsEmail ? (
          <label className={label}>
            {t("auth.complete.email")}
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} autoComplete="email" />
            <span className="mt-1 block text-[11px] normal-case tracking-normal text-zinc-500">{t("auth.complete.emailHint", { provider: providerName })}</span>
          </label>
        ) : (
          <p className="text-xs text-zinc-400 light:text-slate-500">{pending.email}</p>
        )}
        <BirthDateField value={dateOfBirth} onChange={setDateOfBirth} labelClass={label} fieldClass={field} />
        <label className="flex cursor-pointer items-start gap-2.5 text-xs text-zinc-400 light:text-slate-600">
          <input type="checkbox" checked={isAgeVerified} onChange={(e) => setIsAgeVerified(e.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-600" />
          <span><Rich text={t("auth.register.ageCertify")} /></span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 text-xs text-zinc-400 light:text-slate-600">
          <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-600" />
          <span>
            <Rich
              text={t("auth.register.acceptTerms")}
              slots={{
                terms: <Link href="/legal/terms" target="_blank" className="text-violet-400 underline light:text-violet-700">{t("auth.register.terms")}</Link>,
                notice: <Link href="/legal/2257" target="_blank" className="text-violet-400 underline light:text-violet-700">{t("auth.register.notice")}</Link>,
              }}
            />
          </span>
        </label>
        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 py-3.5 text-sm font-bold text-white disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {busy ? t("auth.complete.submitting") : t("auth.complete.submit")}
        </button>
      </form>
    </div>
  );
}
