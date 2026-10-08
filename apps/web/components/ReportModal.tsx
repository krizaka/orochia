"use client";

import React, { useState } from "react";
import { Flag, X, AlertTriangle, CheckCircle2 } from "lucide-react";

export interface ReportModalProps {
  videoId: string;
  videoTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ReportModal({ videoId, videoTitle, isOpen, onClose }: ReportModalProps) {
  const [reason, setReason] = useState<string>("NON_CONSENSUAL");
  const [details, setDetails] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/legal/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          videoTitle,
          reason,
          details,
          reporterEmail: email,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit report. Please try again.");
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 p-6 sm:p-8 shadow-2xl light:bg-white light:border-black/10">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 rounded-full p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors light:text-slate-500 light:hover:text-slate-950"
        >
          <X className="h-5 w-5" />
        </button>

        {submitted ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-white font-display light:text-slate-900">Report Submitted</h3>
            <p className="mt-2 text-sm text-zinc-400 max-w-sm mx-auto light:text-slate-500">
              Our 24/7 compliance and legal safety team has received your ticket. Content flagged for safety or non-consent is triaged immediately.
            </p>
            <button
              onClick={() => {
                setSubmitted(false);
                onClose();
              }}
              className="mt-6 rounded-xl bg-zinc-800 hover:bg-zinc-700 px-6 py-2.5 text-xs font-semibold text-white transition-colors light:bg-slate-100 light:hover:bg-slate-200 light:text-slate-900"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400">
                <Flag className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-display light:text-slate-900">Report Content</h3>
                <p className="text-xs text-zinc-400 light:text-slate-500">Strict legal & safety enforcement</p>
              </div>
            </div>

            <p className="text-xs text-zinc-400 mb-4 light:text-slate-500">
              Flagging: <span className="text-white font-medium italic light:text-slate-900">&quot;{videoTitle}&quot;</span>
            </p>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider light:text-slate-700">
                  Reason for Violation
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3.5 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none light:bg-slate-50 light:border-black/10 light:text-slate-900"
                >
                  <option value="NON_CONSENSUAL">Non-consensual media / Lack of performer release</option>
                  <option value="UNDERAGE">Suspected underage performer (Immediate Removal)</option>
                  <option value="DMCA_COPYRIGHT">Copyright infringement / DMCA Notice</option>
                  <option value="TERMS_VIOLATION">Terms of Service / Prohibited Acts</option>
                  <option value="FRAUD_SCAM">Fraudulent or deceptive content</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider light:text-slate-700">
                  Detailed Explanation
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={3}
                  required
                  placeholder="Provide timestamps, proof of identity, or details regarding the claim..."
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 p-3 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none light:bg-slate-50 light:border-black/10 light:placeholder:text-slate-400 light:text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider light:text-slate-700">
                  Your Contact Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="contact@rights-holder.com"
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3.5 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none light:bg-slate-50 light:border-black/10 light:placeholder:text-slate-400 light:text-slate-900"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-zinc-400 hover:text-white light:bg-slate-50 light:border-black/10 light:text-slate-500 light:hover:text-slate-950"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-rose-600 hover:bg-rose-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-600/25 transition-all disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
