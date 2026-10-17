"use client";

import React, { Suspense } from "react";

import { Spinner } from "@/components/ui";
import { useI18n } from "@/lib/i18n-client";

import { MessagesScreen } from "./MessagesScreen";

export function MessagesFallback() {
  const { t } = useI18n();
  return (
    <div className="flex justify-center py-24 text-fg-muted">
      <Spinner size="md" className="text-current" />
      <span className="sr-only">{t("inbox.loading")}</span>
    </div>
  );
}

/** Messages (the list, the open conversation if any): `/messages` and `/messages/<id>` share this frame. */
export function MessagesFrame({ conversationId }: { conversationId: string | null }) {
  return (
    <Suspense fallback={<MessagesFallback />}>
      <MessagesScreen conversationId={conversationId} />
    </Suspense>
  );
}
