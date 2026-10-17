"use client";

import { CheckIcon, FlagIcon } from "@krizaka/icons";
import React, { useState } from "react";

import { Button, Dialog, RadioGroup, Sheet, Textarea } from "@/components/ui";
import { responseErrorMessage } from "@/lib/api-errors";
import { useI18n } from "@/lib/i18n-client";

import type { ChatMessage } from "./types";

/** In triage order: the most serious first. */
const REASONS = ["UNDERAGE", "NON_CONSENSUAL", "TERMS_VIOLATION", "FRAUD_SCAM"] as const;
type Reason = (typeof REASONS)[number];

/** Report a message one received: a reason and optional details; the message's text goes with the report. */
export function ReportMessageDialog({ conversationId, message, onClose }: { conversationId: string; message: ChatMessage | null; onClose: () => void }) {
  const { t } = useI18n();
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setReason(null);
    setDetails("");
    setSent(false);
    setError(null);
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || !message) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/conversations/${conversationId}/messages/${message.id}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, details: details.trim() || undefined }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError(res ? await responseErrorMessage(t, res, t("inbox.report.failed")) : t("inbox.network"));
    setSent(true);
  };

  return (
    <Dialog.Root open={Boolean(message)} onOpenChange={(open) => !open && close()}>
      <Sheet size="md" aria-describedby={undefined}>
        <Dialog.Header>
          <Dialog.Title>{sent ? t("inbox.report.sent") : t("inbox.report.title")}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          {sent ? (
            <div className="py-6 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-fg-success">
                <CheckIcon size={24} />
              </span>
              <p className="mx-auto mt-3 max-w-sm text-sm text-fg-secondary">{t("inbox.report.sentBody")}</p>
              <Button className="mt-6" onClick={close}>
                {t("report.close")}
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <p className="flex items-start gap-2 pt-1 text-xs text-fg-secondary">
                <FlagIcon size={14} className="mt-0.5 shrink-0 text-fg-danger" />
                <span>{t("inbox.report.subtitle")}</span>
              </p>
              {message && <blockquote className="line-clamp-3 rounded-xl border border-border-default bg-surface-2 px-3 py-2 text-sm text-fg">{message.content}</blockquote>}
              <div>
                <span id="report-message-reason" className="mb-2 block text-xs font-semibold text-fg-secondary">
                  {t("inbox.report.reason")}
                </span>
                <RadioGroup.Root aria-labelledby="report-message-reason" value={reason ?? ""} onValueChange={(v) => setReason(v as Reason)} className="space-y-2">
                  {REASONS.map((r) => (
                    <RadioGroup.Card key={r} value={r} className="w-full gap-0 rounded-2xl data-[state=checked]:border-danger/60 data-[state=checked]:bg-danger/10">
                      <span className="block text-sm font-semibold text-fg">{t(`report.reasons.${r}.title`)}</span>
                      <span className="block text-xs text-fg-secondary">{t(`report.reasons.${r}.hint`)}</span>
                    </RadioGroup.Card>
                  ))}
                </RadioGroup.Root>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-fg-secondary">{t("inbox.report.details")}</span>
                <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={2000} placeholder={t("inbox.report.detailsPlaceholder")} className="w-full resize-y rounded-xl px-3.5 py-2.5 text-sm" />
              </label>
              {error && (
                <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-fg-danger">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={close}>
                  {t("report.cancel")}
                </Button>
                <Button type="submit" variant="danger" loading={busy} disabled={!reason}>
                  {t("inbox.report.submit")}
                </Button>
              </div>
            </form>
          )}
        </Dialog.Body>
      </Sheet>
    </Dialog.Root>
  );
}
