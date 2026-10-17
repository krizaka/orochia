"use client";

import { MessageIcon } from "@krizaka/icons";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

import { Button, EmptyState } from "@/components/ui";
import { responseErrorMessage } from "@/lib/api-errors";
import { useAuth } from "@/lib/auth-context";
import { conversationPath } from "@/lib/conversation-path";
import { useI18n } from "@/lib/i18n-client";

/** An invitation to a group: signed out, sign in first (and come back); otherwise one button joins it. */
export function JoinGroup({ token }: { token: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/groups/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError(res ? await responseErrorMessage(t, res, t("inbox.group.joinFailed")) : t("inbox.network"));
    router.replace(conversationPath(((await res.json()) as { conversationId: string }).conversationId));
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <EmptyState icon={<MessageIcon size={32} />} title={t("inbox.group.joinTitle")} description={t("inbox.group.joinBody")} />
      <div className="mt-6 flex flex-col items-center gap-3">
        {!isLoading && !user ? (
          <Button variant="primary" shape="cut" onClick={() => router.push(`/auth/login?next=${encodeURIComponent(`/messages/join/${token}`)}`)}>
            {t("inbox.group.joinSignIn")}
          </Button>
        ) : (
          <Button variant="primary" shape="cut" loading={busy} disabled={isLoading} onClick={() => void join()}>
            {t("inbox.group.join")}
          </Button>
        )}
        {error && (
          <p role="alert" className="text-xs text-fg-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
