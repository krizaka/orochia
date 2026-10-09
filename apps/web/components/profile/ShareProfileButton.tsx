"use client";

import React, { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { t } from "@/lib/i18n";

/** Shares a profile: the phone's share sheet when there is one, otherwise the link is copied. */
export function ShareProfileButton({ username, displayName }: { username: string; displayName: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = `${window.location.origin}/@${username}`;
    if (navigator.share) {
      await navigator.share({ title: `${displayName} on Orochia`, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={() => void share()}
      className="inline-flex items-center gap-2 rounded-xl border border-border-default px-3.5 py-2.5 text-xs font-semibold text-fg transition-colors hover:border-accent/60 hover:bg-accent/10"
    >
      {copied ? <Check className="h-4 w-4 text-success" /> : <Share2 className="h-4 w-4" />}
      {copied ? t("profile.copied") : t("profile.share")}
    </button>
  );
}
