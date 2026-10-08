"use client";

import React, { useState } from "react";
import Link from "next/link";
import { SocialSignIn } from "@/components/SocialSignIn";
import { useRouter } from "next/navigation";
import { Lock, Mail, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { OrochiaLogo } from "@/components/OrochiaLogo";
import { BirthDateField, isAdultBirthDate } from "@/components/BirthDateField";
import { UsernameField } from "@/components/UsernameField";
import { Rich } from "@/components/Rich";
import { t } from "@/lib/i18n";

const label = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400 light:text-slate-500";
const field =
  "w-full rounded-xl border border-white/10 light:border-black/10 bg-zinc-900 light:bg-slate-50 py-2.5 text-sm text-white light:text-slate-900 placeholder:text-zinc-600 light:placeholder:text-slate-400 focus:border-violet-500 focus:outline-none";

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
      <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 light:border-black/5 bg-zinc-950 light:bg-white p-6 shadow-2xl sm:p-8">
        <div className="pointer-events-none absolute -top-20 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-fuchsia-600/25 light:bg-fuchsia-300/30 blur-3xl" />

        <div className="relative mb-6 text-center">
          <OrochiaLogo size={64} className="mx-auto mb-3" />
          <h1 className="font-display text-2xl font-black text-white light:text-slate-900">{t("auth.register.title")}</h1>
          <p className="mt-1.5 text-sm text-zinc-400 light:text-slate-500">{t("auth.register.subtitle")}</p>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
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

          <div className="space-y-2.5 border-t border-white/5 light:border-black/5 pt-3">
            <label className="flex cursor-pointer items-start gap-2.5 text-xs text-zinc-400 light:text-slate-600">
              <input type="checkbox" checked={isAgeVerified} onChange={(e) => setIsAgeVerified(e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-violet-600" />
              <span>
                <Rich text={t("auth.register.ageCertify")} />
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 text-xs text-zinc-400 light:text-slate-600">
              <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-violet-600" />
              <span>
                <Rich
                  text={t("auth.register.acceptTerms")}
                  slots={{
                    terms: (
                      <Link href="/legal/terms" target="_blank" className="text-violet-400 underline light:text-violet-700">
                        {t("auth.register.terms")}
                      </Link>
                    ),
                    notice: (
                      <Link href="/legal/2257" target="_blank" className="text-violet-400 underline light:text-violet-700">
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
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 py-3.5 text-sm font-bold text-white shadow-xl shadow-fuchsia-600/25 transition-all hover:from-violet-500 hover:to-pink-500 disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" />
            {isLoading ? t("auth.register.submitting") : t("auth.register.submit")}
          </button>
        </form>

        <p className="relative mt-6 text-center text-xs text-zinc-400 light:text-slate-500">
          {t("auth.register.haveAccount")}{" "}
          <Link href="/auth/login" className="font-semibold text-violet-400 hover:underline light:text-violet-700">
            {t("auth.register.signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
