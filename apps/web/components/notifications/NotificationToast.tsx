"use client";

import { X } from "lucide-react";
import React from "react";

import { IconButton } from "@/components/ui";
import { t } from "@/lib/i18n";

import { NotificationRow } from "./NotificationRow";
import type { NotificationItem } from "./useNotifications";

/** A notification that just arrived, as a toast (`toast.custom`): a tap opens it, the cross dismisses it. */
export function NotificationToast({ n, onOpen, onDismiss }: { n: NotificationItem; onOpen: () => void; onDismiss: () => void }) {
  return (
    <div className="relative w-full pr-6">
      <NotificationRow n={n} compact onOpen={onOpen} />
      <IconButton onClick={onDismiss} shape="rounded" label={t("notifications.dismiss")} className="absolute -right-2 -top-2 h-6 w-6">
        <X className="h-3.5 w-3.5" aria-hidden />
      </IconButton>
    </div>
  );
}
