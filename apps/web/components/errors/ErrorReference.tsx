"use client";

import { CheckIcon, CopyIcon } from "@krizaka/icons";
import { useState } from "react";

import { IconButton } from "@/components/ui";
import { t } from "@/lib/i18n";

/**
 * The reference of an error (Next's digest — the same number as in the server's logs), small and copyable: what
 * support asks for, never a raw shout in the corner of the page.
 */
export function ErrorReference({ digest }: { digest: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(digest);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the reference stays selectable */
    }
  };
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-surface-1/80 py-1 pl-4 pr-1 text-xs backdrop-blur-md">
      <span className="text-fg-muted">{t("errorPages.reference")}</span>
      <code className="select-all font-mono text-fg">{digest}</code>
      <IconButton size="sm" label={copied ? t("errorPages.copied") : t("errorPages.copyReference")} onClick={copy}>
        {copied ? <CheckIcon size={14} className="text-fg-success" /> : <CopyIcon size={14} />}
      </IconButton>
      <span className="sr-only" role="status">
        {copied ? t("errorPages.copied") : ""}
      </span>
    </div>
  );
}
