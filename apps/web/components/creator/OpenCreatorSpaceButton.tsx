"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";

import { Button } from "@/components/ui";
import { apiErrorMessage } from "@/lib/api-errors";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";

/**
 * The one action of the creator application: the signed-in member's own account becomes a creator space, pending the
 * 2257 review (`POST /api/me/become-creator`). The page then re-renders as the status of that review.
 */
export function OpenCreatorSpaceButton({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const { refresh } = useAuth();
  const [state, setState] = useState<"idle" | "working">("idle");
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setState("working");
    setError(null);
    const res = await fetch("/api/me/become-creator", { method: "POST" }).catch(() => null);
    if (!res?.ok) {
      setError(apiErrorMessage(res ? await res.json().catch(() => null) : null, t("creatorSpace.apply.failed")));
      return setState("idle");
    }
    await refresh();
    router.refresh();
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="sensual" size="lg" shimmer onClick={open} loading={state === "working"} disabled={disabled} className="font-bold">
        {state === "working" ? t("creatorSpace.apply.working") : t("creatorSpace.apply.cta")}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-fg-danger">
          {error}
        </p>
      )}
    </div>
  );
}
