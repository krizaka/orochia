"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";

/** Opens a creator space for a member (pending the 2257 review); the account keeps tipping and unlocking. */
export function BecomeCreatorCard() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [state, setState] = useState<"idle" | "working" | "error">("idle");

  const become = async () => {
    setState("working");
    const res = await fetch("/api/me/become-creator", { method: "POST" }).catch(() => null);
    if (!res?.ok) return setState("error");
    await refresh();
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
        <Sparkles className="h-7 w-7" />
      </div>
      <h1 className="font-display text-2xl font-bold text-fg">{t("auth.becomeCreator.title")}</h1>
      <p className="mt-2 text-sm text-fg-secondary">{t("auth.becomeCreator.body")}</p>
      <Button variant="sensual" size="lg" shape="rounded" onClick={become} loading={state === "working"} className="mt-6 rounded-xl px-6 font-bold">
        {state === "working" ? t("auth.becomeCreator.working") : t("auth.becomeCreator.cta")}
      </Button>
      {state === "error" && <p role="alert" className="mt-3 text-xs text-danger">{t("auth.becomeCreator.failed")}</p>}
    </div>
  );
}
