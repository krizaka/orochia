"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Rich } from "@/components/Rich";
import { t } from "@/lib/i18n";
import { Avatar, Button, buttonVariants, Checkbox, Field, Input, Spinner } from "@/components/ui";
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

  if (pending === null) return <div className="flex min-h-[50vh] items-center justify-center"><Spinner size="md" /></div>;
  if (pending === "expired") {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-sm text-fg-secondary">{t("auth.complete.expired")}</p>
        <Link href="/auth/login" className={buttonVariants({ variant: "primary", shape: "rounded", className: "mt-6 rounded-xl px-6 font-bold" })}>{t("auth.complete.restart")}</Link>
      </div>
    );
  }

  const providerName = t(`auth.complete.providers.${pending.provider}`);
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <form onSubmit={submit} className="space-y-4 rounded-3xl border border-border-default bg-surface-1 p-6 shadow-2xl sm:p-8">
        <div className="text-center">
          {pending.avatarUrl && <Avatar src={pending.avatarUrl} fallback={pending.displayName.charAt(0)} className="mx-auto mb-3 h-16 w-16" />}
          <h1 className="font-display text-2xl font-black text-fg">{t("auth.complete.title")}</h1>
          <p className="mt-1.5 text-sm text-fg-secondary">{t("auth.complete.subtitle", { provider: providerName })}</p>
        </div>
        {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">{error}</p>}
        <UsernameField value={username} onChange={setUsername} />
        <Field.Root>
          <Field.Label htmlFor="displayName" className="uppercase tracking-wider">{t("auth.register.displayName")}</Field.Label>
          <Input id="displayName" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="rounded-xl px-3.5" />
        </Field.Root>
        {pending.needsEmail ? (
          <Field.Root>
            <Field.Label htmlFor="email" className="uppercase tracking-wider">{t("auth.complete.email")}</Field.Label>
            <Input id="email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl px-3.5" autoComplete="email" aria-describedby="email-hint" />
            <Field.Hint id="email-hint" className="text-[11px]">{t("auth.complete.emailHint", { provider: providerName })}</Field.Hint>
          </Field.Root>
        ) : (
          <p className="text-xs text-fg-secondary">{pending.email}</p>
        )}
        <BirthDateField value={dateOfBirth} onChange={setDateOfBirth} />
        <Checkbox checked={isAgeVerified} onCheckedChange={(on) => setIsAgeVerified(on === true)} className="gap-2.5 text-xs text-fg-secondary">
          <span><Rich text={t("auth.register.ageCertify")} /></span>
        </Checkbox>
        <Checkbox checked={acceptTerms} onCheckedChange={(on) => setAcceptTerms(on === true)} className="gap-2.5 text-xs text-fg-secondary">
          <span>
            <Rich
              text={t("auth.register.acceptTerms")}
              slots={{
                terms: <Link href="/legal/terms" target="_blank" className="text-accent underline">{t("auth.register.terms")}</Link>,
                notice: <Link href="/legal/2257" target="_blank" className="text-accent underline">{t("auth.register.notice")}</Link>,
              }}
            />
          </span>
        </Checkbox>
        <Button type="submit" variant="sensual" size="lg" shape="rounded" loading={busy} className="w-full rounded-xl font-bold">
          {!busy && <UserPlus className="h-4 w-4" aria-hidden />}
          {busy ? t("auth.complete.submitting") : t("auth.complete.submit")}
        </Button>
      </form>
    </div>
  );
}
