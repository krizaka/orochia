"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { SocialSignIn } from "@/components/SocialSignIn";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LogIn, Lock, Mail, ArrowRight, Sparkles } from "lucide-react";
import { Button, Field, Input, OrochiaLogo } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const { login, switchProfile, demoMode } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Back from a provider that could not sign the visitor in (?error=cancelled|state|provider|suspended).
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("error");
    if (reason && ["cancelled", "state", "provider", "suspended"].includes(reason)) {
      setError(t(`auth.social.errors.${reason as "cancelled" | "state" | "provider" | "suspended"}`));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await login(email, password);
      // Back where the visitor was sent from (?next=/creator/upload) — same-site paths only.
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next && /^\/(?!\/)/.test(next) ? next : "/dashboard");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t("auth.login.failed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center justify-center px-4 py-12">
      <div className="w-full overflow-hidden rounded-3xl border border-border-default bg-surface-1 p-8 shadow-2xl relative">
        {/* Ambient Top Glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-40 w-40 rounded-full bg-accent/30 blur-3xl pointer-events-none" />

        <div className="text-center mb-8">
          <OrochiaLogo size={72} className="mx-auto mb-3" />
          <h1 className="text-2xl font-black text-fg font-display">{t("auth.login.title")}</h1>
          <p className="mt-1 text-xs text-fg-secondary">
            {t("auth.login.subtitle")}
          </p>
        </div>

        {/* Demo accounts — only in demo mode (never in production) */}
        {demoMode && (
        <div className="mb-6 rounded-2xl border border-accent/20 bg-accent/5 p-3.5">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-accent">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span>{t("auth.login.demo")}</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              shape="rounded"
              onClick={async () => {
                await switchProfile("creator");
                router.push("/dashboard");
              }}
            >
              {t("auth.login.demoCreator")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              shape="rounded"
              onClick={async () => {
                await switchProfile("patron");
                router.push("/dashboard");
              }}
            >
              {t("auth.login.demoMember")}
            </Button>
          </div>
        </div>
        )}

        <div className="relative mb-4"><SocialSignIn /></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field.Root>
            <Field.Label htmlFor="identifier" className="uppercase tracking-wider">
              {t("auth.login.identifier")}
            </Field.Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-fg-muted" aria-hidden />
              <Input
                id="identifier"
                type="text"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.login.identifierPlaceholder")}
                className="rounded-xl pl-10"
              />
            </div>
          </Field.Root>

          <Field.Root>
            <div className="flex items-center justify-between">
              <Field.Label htmlFor="password" className="uppercase tracking-wider">
                {t("auth.login.password")}
              </Field.Label>
              <Link href="/auth/forgot-password" className="text-xs text-accent hover:underline">
                {t("auth.login.forgot")}
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-fg-muted" aria-hidden />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="rounded-xl pl-10"
              />
            </div>
          </Field.Root>

          {error && (
            <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-xs text-danger">
              {error}
            </p>
          )}

          <Button type="submit" variant="sensual" size="lg" shape="rounded" loading={isLoading} className="mt-6 w-full rounded-xl font-bold">
            {!isLoading && <LogIn className="h-4 w-4" aria-hidden />}
            <span>{isLoading ? t("auth.login.submitting") : t("auth.login.submit")}</span>
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-fg-secondary">
          {t("auth.login.new")}{" "}
          <Link href="/auth/register" className="font-semibold text-accent hover:underline">
            {t("auth.login.register")}
          </Link>
        </p>
      </div>
    </div>
  );
}
