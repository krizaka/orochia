"use client";

import { OrochiaLogo } from "@krizaka/orochia-design-system";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
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
    <div className="flex min-h-screen w-full items-center justify-center px-4">
      <Card.Root tone="elevated" radius="xl" className="w-full max-w-sm shadow-lg">
        <Card.Body padding="lg">
          <form onSubmit={submit} className="space-y-4">
            <div className="text-center">
              <OrochiaLogo size={72} className="mx-auto mb-2" />
              <h1 className="font-display text-xl font-bold text-fg">Orochia Control Plane</h1>
              <p className="mt-1 text-xs text-fg-secondary">The operator account only</p>
            </div>
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
        </Card.Body>
      </Card.Root>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
