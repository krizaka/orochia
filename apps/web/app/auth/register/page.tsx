"use client";

import React, { useState } from "react";
import Link from "next/link";
import { SocialSignIn } from "@/components/SocialSignIn";
import { useRouter } from "next/navigation";
import { Lock, Mail, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { OrochiaLogo } from "@/components/ui";
import { BirthDateField, isAdultBirthDate } from "@/components/BirthDateField";
import { UsernameField } from "@/components/UsernameField";
import { Rich } from "@/components/Rich";
import { t } from "@/lib/i18n";

const label = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fg-secondary";
const field =
  "w-full rounded-xl border border-border-default bg-surface-2 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:border-accent focus:outline-hidden";

/**
 * One kind of account: everyone joins to watch, follow, tip and unlock. Publishing is opened later
 * from the dashboard ("Become a creator"), behind the 2257 verification.
 */
export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isAdultBirthDate(dateOfBirth)) return setError(t("auth.register.errors.birthDate"));
    if (!isAgeVerified) return setError(t("auth.register.errors.age"));
    if (password.length < 10) return setError(t("auth.register.errors.password"));
    if (!acceptTerms) return setError(t("auth.register.errors.terms"));
    setIsLoading(true);
    try {
      await register({ username, displayName: displayName || username, email, password, dateOfBirth, isAgeVerified, acceptTerms });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.register.errors.failed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-lg items-center justify-center px-4 py-12">
      <div className="relative w-full overflow-hidden rounded-3xl border border-border-default bg-surface-1 p-6 shadow-2xl sm:p-8">
        <div className="pointer-events-none absolute -top-20 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-accent/25 blur-3xl" />

        <div className="relative mb-6 text-center">
          <OrochiaLogo size={64} className="mx-auto mb-3" />
          <h1 className="font-display text-2xl font-black text-fg">{t("auth.register.title")}</h1>
          <p className="mt-1.5 text-sm text-fg-secondary">{t("auth.register.subtitle")}</p>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
            {error}
          </div>
        )}

        <div className="relative mb-4"><SocialSignIn /></div>
        <form onSubmit={handleSubmit} className="relative space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <UsernameField value={username} onChange={setUsername} labelClass={label} fieldClass={field} />
            <label className={label}>
              {t("auth.register.displayName")}
              <input
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("auth.register.displayNamePlaceholder")}
                className={`${field} mt-1.5 px-3.5 normal-case tracking-normal`}
              />
            </label>
          </div>

          <label className={label}>
            {t("auth.register.email")}
            <div className="relative mt-1.5">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.register.emailPlaceholder")}
                className={`${field} pl-10 pr-4 normal-case tracking-normal`}
              />
            </div>
          </label>

          <label className={label}>
            {t("auth.register.password")}
            <div className="relative mt-1.5">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
              <input
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.register.passwordHint")}
                className={`${field} pl-10 pr-4 normal-case tracking-normal`}
              />
            </div>
          </label>

          <BirthDateField value={dateOfBirth} onChange={setDateOfBirth} labelClass={label} fieldClass={field} />

          <div className="space-y-2.5 border-t border-border-subtle pt-3">
            <label className="flex cursor-pointer items-start gap-2.5 text-xs text-fg-secondary">
              <input type="checkbox" checked={isAgeVerified} onChange={(e) => setIsAgeVerified(e.target.checked)} className="mt-0.5 h-4 w-4 rounded-sm accent-accent" />
              <span>
                <Rich text={t("auth.register.ageCertify")} />
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 text-xs text-fg-secondary">
              <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5 h-4 w-4 rounded-sm accent-accent" />
              <span>
                <Rich
                  text={t("auth.register.acceptTerms")}
                  slots={{
                    terms: (
                      <Link href="/legal/terms" target="_blank" className="text-accent underline">
                        {t("auth.register.terms")}
                      </Link>
                    ),
                    notice: (
                      <Link href="/legal/2257" target="_blank" className="text-accent underline">
                        {t("auth.register.notice")}
                      </Link>
                    ),
                  }}
                />
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-accent via-accent-2 to-accent-2 py-3.5 text-sm font-bold text-white shadow-xl shadow-accent/25 transition-all hover:from-accent hover:to-accent-2 disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" />
            {isLoading ? t("auth.register.submitting") : t("auth.register.submit")}
          </button>
        </form>

        <p className="relative mt-6 text-center text-xs text-fg-secondary">
          {t("auth.register.haveAccount")}{" "}
          <Link href="/auth/login" className="font-semibold text-accent hover:underline">
            {t("auth.register.signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
