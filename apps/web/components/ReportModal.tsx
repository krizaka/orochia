"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Flag } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button, Sheet, cx } from "@/components/ui";
import { t } from "@/lib/i18n";

export interface ReportModalProps {
  videoId: string;
  videoTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

/** In triage order: the most serious first (suspected minors, non-consensual content). */
const REASONS = ["UNDERAGE", "NON_CONSENSUAL", "DMCA_COPYRIGHT", "TERMS_VIOLATION", "FRAUD_SCAM"] as const;
type Reason = (typeof REASONS)[number];

const field =
  "w-full rounded-xl border border-white/10 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none light:border-black/10 light:bg-slate-50 light:text-slate-900 light:placeholder:text-slate-400";

/** Report a video: a reason, details and a contact address; persisted before it is acknowledged (compliance_reports). */
export function ReportModal({ videoId, videoTitle, isOpen, onClose }: ReportModalProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (user?.email) setEmail((e) => e || user.email);
  }, [user]);

  const close = () => {
    setSent(false);
    setReason(null);
    setDetails("");
    setError(null);
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/legal/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, videoTitle, reason, details, reporterEmail: email }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError(t("report.failed"));
    setSent(true);
  };

  return (
    <Sheet open={isOpen} onClose={close} title={sent ? t("report.sent") : t("report.title")}>
      {sent ? (
        <div className="py-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
          <p className="mx-auto mt-3 max-w-sm text-sm text-zinc-300 light:text-slate-700">{t("report.sentBody")}</p>
          <Button className="mt-6" onClick={close}>
            {t("report.close")}
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="flex items-start gap-2 pt-1 text-xs text-zinc-400 light:text-slate-500">
            <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
            <span>
              {t("report.subtitle")} <span className="italic text-zinc-300 light:text-slate-700">{t("report.about", { title: videoTitle })}</span>
            </span>
          </p>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-zinc-300 light:text-slate-700">{t("report.reason")}</legend>
            <div className="space-y-2" role="radiogroup">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={reason === r}
                  onClick={() => setReason(r)}
                  className={cx(
                    "w-full rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400",
                    reason === r ? "border-rose-500/60 bg-rose-500/10" : "border-white/10 hover:border-white/25 light:border-black/10 light:hover:border-black/25",
                  )}
                >
                  <span className="block text-sm font-semibold text-white light:text-slate-900">{t(`report.reasons.${r}.title`)}</span>
                  <span className="block text-xs text-zinc-400 light:text-slate-500">{t(`report.reasons.${r}.hint`)}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-zinc-300 light:text-slate-700">{t("report.details")}</span>
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} required placeholder={t("report.detailsPlaceholder")} className={`${field} resize-y`} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-zinc-300 light:text-slate-700">{t("report.email")}</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={field} />
            <span className="mt-1 block text-[11px] text-zinc-500">{t("report.emailHint")}</span>
          </label>

          {error && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 light:text-rose-700">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={close}>
              {t("report.cancel")}
            </Button>
            <Button type="submit" variant="danger" loading={busy} disabled={!reason}>
              {t("report.submit")}
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
