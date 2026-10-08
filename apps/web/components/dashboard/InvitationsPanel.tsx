"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Mail, Copy, Check, Plus, Loader2, Sparkles, UserCheck, Clock } from "lucide-react";

interface Invitation {
  id: string;
  code: string;
  email: string | null;
  status: "PENDING" | "ACCEPTED" | "EXPIRED";
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export function InvitationsPanel() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailInput, setEmailInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [lastCreatedCode, setLastCreatedCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadInvitations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/me/invitations", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations || []);
      }
    } catch (e) {
      console.error("Failed to load invitations", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/me/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput.trim() || undefined }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create invitation");
        return;
      }

      setLastCreatedCode(data.invitation.code);
      setEmailInput("");
      await loadInvitations();
    } catch (err: any) {
      setError(err?.message || "Network error creating invitation");
    } finally {
      setCreating(false);
    }
  };

  const copyInviteLink = (code: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const link = `${origin}/auth/register?invite=${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Create Invitation Card */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white font-display light:text-slate-900">
              Invite Creators & Friends
            </h3>
            <p className="text-xs text-zinc-400 light:text-slate-500">
              When friends register using your invite link, you automatically become mutual contacts.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateInvite} className="mt-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Mail className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Friend's email (optional)"
              className="w-full rounded-2xl border border-white/10 bg-zinc-900/60 pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none light:bg-slate-50 light:border-black/10 light:text-slate-900"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/20 hover:opacity-90 transition-all disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span>Generate Invite Code</span>
          </button>
        </form>

        {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}

        {lastCreatedCode && (
          <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  New Invite Link Ready
                </span>
                <p className="text-xs font-mono text-emerald-200 mt-0.5 select-all">
                  Code: <strong className="text-white">{lastCreatedCode}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyInviteLink(lastCreatedCode)}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
              >
                {copiedCode === lastCreatedCode ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Full Invite Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invitations History Table */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 light:text-slate-500 mb-4">
          Sent Invitations <span className="font-mono text-zinc-500">({invitations.length})</span>
        </h3>

        {loading ? (
          <div className="py-8 text-center text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            <span className="text-xs">Loading invitations...</span>
          </div>
        ) : invitations.length === 0 ? (
          <p className="text-xs text-zinc-500 py-6 text-center">
            You haven&apos;t generated any invitation links yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-zinc-400 light:border-black/10 light:text-slate-500">
                  <th className="pb-3 pr-4 font-mono">Code</th>
                  <th className="pb-3 pr-4">Recipient</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Created</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 light:divide-black/5">
                {invitations.map((inv) => (
                  <tr key={inv.id} className="text-zinc-300 light:text-slate-700">
                    <td className="py-3 pr-4 font-mono font-bold text-violet-400">{inv.code}</td>
                    <td className="py-3 pr-4">
                      {inv.email ? inv.email : <span className="text-zinc-500">Open Link</span>}
                    </td>
                    <td className="py-3 pr-4">
                      {inv.status === "ACCEPTED" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                          <UserCheck className="h-3 w-3" /> Accepted
                        </span>
                      ) : inv.status === "EXPIRED" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
                          <Clock className="h-3 w-3" /> Expired
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                          <Clock className="h-3 w-3" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-zinc-500 font-mono text-[11px]">
                      {new Date(inv.createdAt).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => copyInviteLink(inv.code)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 hover:border-violet-500/40 text-[11px] text-zinc-300 hover:text-white transition-colors"
                        title="Copy link"
                      >
                        {copiedCode === inv.code ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
