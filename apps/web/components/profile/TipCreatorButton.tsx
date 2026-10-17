"use client";

import { Coins } from "lucide-react";
import React, { useState } from "react";

import { TipModal } from "@/components/TipModal";
import { buttonVariants, cn } from "@/components/ui";
import { useI18n } from "@/lib/i18n-client";

/** « Tip » on a creator's profile: opens the same tip sheet as the watch page, on their latest video. */
export function TipCreatorButton({ creatorName, videoId, minTipAmountCents }: { creatorName: string; videoId: string; minTipAmountCents?: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn(buttonVariants({ variant: "secondary", size: "sm", shape: "pill" }))}>
        <Coins className="h-4 w-4" aria-hidden /> {t("profile.tip")}
      </button>
      <TipModal isOpen={open} onClose={() => setOpen(false)} videoId={videoId} creatorName={creatorName} minTipAmountCents={minTipAmountCents || 500} onUnlockedSuccess={() => setOpen(false)} />
    </>
  );
}
