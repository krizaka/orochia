"use client";

import React, { useState } from "react";
import Link from "next/link";
import { SocialSignIn } from "@/components/SocialSignIn";
import { useRouter } from "next/navigation";
import { Lock, Mail, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button, Field, Input, OrochiaLogo } from "@/components/ui";
import { BirthDateField, isAdultBirthDate } from "@/components/BirthDateField";
import { UsernameField } from "@/components/UsernameField";
import { Rich } from "@/components/Rich";
import { t } from "@/lib/i18n";


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
            <UsernameField value={username} onChange={setUsername} />
            <Field.Root>
              <Field.Label htmlFor="displayName" className="uppercase tracking-wider">
                {t("auth.register.displayName")}
              </Field.Label>
              <Input
                id="displayName"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("auth.register.displayNamePlaceholder")}
                className="rounded-xl px-3.5"
              />
            </Field.Root>
          </div>

          <Field.Root>
            <Field.Label htmlFor="email" className="uppercase tracking-wider">
              {t("auth.register.email")}
            </Field.Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-fg-muted" aria-hidden />
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.register.emailPlaceholder")}
                className="rounded-xl pl-10"
              />
            </div>
          </Field.Root>

          <Field.Root>
            <Field.Label htmlFor="password" className="uppercase tracking-wider">
              {t("auth.register.password")}
            </Field.Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-fg-muted" aria-hidden />
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.register.passwordHint")}
                className="rounded-xl pl-10"
              />
            </div>
          </Field.Root>

          <BirthDateField value={dateOfBirth} onChange={setDateOfBirth} />

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

          <Button type="submit" variant="sensual" size="lg" shape="rounded" loading={isLoading} className="mt-2 w-full rounded-xl font-bold">
            {!isLoading && <UserPlus className="h-4 w-4" aria-hidden />}
            {isLoading ? t("auth.register.submitting") : t("auth.register.submit")}
          </Button>
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
