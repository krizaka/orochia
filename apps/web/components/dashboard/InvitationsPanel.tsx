"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Mail, Copy, Check, Plus, Sparkles, UserCheck, Clock } from "lucide-react";
import { Badge, Button, Input, Spinner } from "@/components/ui";
import { t } from "@/lib/i18n";
import { Rich } from "@/components/Rich";

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
        setError(data.error || t("invites.createFailed"));
        return;
      }

      setLastCreatedCode(data.invitation.code);
      setEmailInput("");
      await loadInvitations();
    } catch (err) {
      setError((err instanceof Error && err.message) || t("invites.networkError"));
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
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-tr from-accent to-accent-2 text-white shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-fg font-display">
              {t("invites.title")}
            </h3>
            <p className="text-xs text-fg-secondary">
              {t("invites.intro")}
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateInvite} className="mt-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Mail className="absolute left-3.5 top-3 h-4 w-4 text-fg-muted" aria-hidden />
            <Input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder={t("invites.emailPlaceholder")}
              className="h-10 rounded-2xl bg-surface-2/60 pl-10 pr-4 text-xs"
            />
          </div>
          <Button type="submit" variant="sensual" shape="rounded" loading={creating} className="rounded-2xl px-6 text-xs font-bold">
            {!creating && <Plus className="h-4 w-4" aria-hidden />}
            <span>{t("invites.create")}</span>
          </Button>
        </form>

        {error && <p className="mt-3 text-xs text-danger">{error}</p>}

        {lastCreatedCode && (
          <div className="mt-4 rounded-2xl border border-success/30 bg-success/10 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-success">
                  {t("invites.ready")}
                </span>
                <p className="text-xs font-mono text-success mt-0.5 select-all">
                  <Rich text={t("invites.code")} slots={{ code: <strong className="text-fg">{lastCreatedCode}</strong> }} />
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                shape="rounded"
                onClick={() => copyInviteLink(lastCreatedCode)}
                className="rounded-xl bg-success hover:bg-success/90"
              >
                {copiedCode === lastCreatedCode ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>{t("common.copied")}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>{t("invites.copyLink")}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Invitations History Table */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8">
        <h3 className="text-xs font-bold uppercase tracking-widest text-fg-secondary mb-4">
          {t("invites.sent")} <span className="font-mono text-fg-muted">({invitations.length})</span>
        </h3>

        {loading ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-fg-muted">
            <Spinner label={t("invites.loading")} />
            <span className="text-xs">{t("invites.loading")}</span>
          </div>
        ) : invitations.length === 0 ? (
          <p className="text-xs text-fg-muted py-6 text-center">
            {t("invites.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border-default text-fg-secondary">
                  <th className="pb-3 pr-4 font-mono">{t("invites.colCode")}</th>
                  <th className="pb-3 pr-4">{t("invites.colRecipient")}</th>
                  <th className="pb-3 pr-4">{t("invites.colStatus")}</th>
                  <th className="pb-3 pr-4">{t("invites.colCreated")}</th>
                  <th className="pb-3 text-right">{t("invites.colActions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {invitations.map((inv) => (
                  <tr key={inv.id} className="text-fg-secondary">
                    <td className="py-3 pr-4 font-mono font-bold text-accent">{inv.code}</td>
                    <td className="py-3 pr-4">
                      {inv.email ? inv.email : <span className="text-fg-muted">{t("invites.openLink")}</span>}
                    </td>
                    <td className="py-3 pr-4">
                      {inv.status === "ACCEPTED" ? (
                        <Badge size="sm" tone="success" className="normal-case tracking-normal">
                          <UserCheck className="h-3 w-3" aria-hidden /> {t("invites.status.ACCEPTED")}
                        </Badge>
                      ) : inv.status === "EXPIRED" ? (
                        <Badge size="sm" tone="neutral" className="normal-case tracking-normal">
                          <Clock className="h-3 w-3" aria-hidden /> {t("invites.status.EXPIRED")}
                        </Badge>
                      ) : (
                        <Badge size="sm" tone="warning" className="normal-case tracking-normal">
                          <Clock className="h-3 w-3" aria-hidden /> {t("invites.status.PENDING")}
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-fg-muted font-mono text-[11px]">
                      {new Date(inv.createdAt).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        shape="rounded"
                        onClick={() => copyInviteLink(inv.code)}
                        className="h-7 gap-1 px-2.5 text-[11px]"
                        title={t("invites.copyTitle")}
                      >
                        {copiedCode === inv.code ? (
                          <>
                            <Check className="h-3 w-3 text-success" />
                            <span className="text-success">{t("common.copied")}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>{t("common.copy")}</span>
                          </>
                        )}
                      </Button>
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
