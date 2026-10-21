"use client";

import { OrochiaLogo } from "@krizaka/orochia-design-system";
import { AuthLayout } from "@krizaka/ui/auth-layout";
import { Button } from "@krizaka/ui/button";
import { Field, Input } from "@krizaka/ui/field";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const expired = useSearchParams().get("expired");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(expired ? "Your session ended. Please sign in again." : null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Sign-in failed");
      return;
    }
    router.replace("/");
    router.refresh();
  };

  return (
    <AuthLayout
      brand={
        <>
          <OrochiaLogo size={32} />
          Orochia
        </>
      }
      title="Orochia Control Plane"
      description="The operator account only"
      promise="The operator's desk."
      aside="Reports, verifications, payouts and the audit of every decision, on the real platform."
      asideFooter="© Krizaka · Montréal"
    >
      <form onSubmit={submit} className="space-y-4">
        <Field.Root>
          <Field.Label htmlFor="email">E-mail</Field.Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </Field.Root>
        <Field.Root>
          <Field.Label htmlFor="password">Password</Field.Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field.Root>
        {error && <Field.Error>{error}</Field.Error>}
        <Button type="submit" variant="primary" loading={busy} className="w-full">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
