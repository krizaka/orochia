"use client";

import React, { useEffect, useState } from "react";
import { AtSign, Check, Loader2 } from "lucide-react";
import { t } from "@/lib/i18n";

type Status = { available: boolean; reason?: "format" | "reserved" | "taken"; suggestion?: string } | null;

/**
 * The username at sign-up: it is the account's public address (orochia.com/@username) and unique, so it is checked
 * while typing and a free one is offered when it is taken (two "Oussama Abid" → @oussama_abid, @oussama_abid2).
 */
export function UsernameField({ value, onChange, labelClass, fieldClass }: { value: string; onChange: (v: string) => void; labelClass: string; fieldClass: string }) {
  const [status, setStatus] = useState<Status>(null);
  const [checking, setChecking] = useState(false);
  const username = value.trim().toLowerCase().replace(/^@/, "");

  useEffect(() => {
    if (username.length < 3) return setStatus(null);
    setChecking(true);
    const timer = setTimeout(() => {
      fetch(`/api/auth/username?username=${encodeURIComponent(username)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: Status) => setStatus(d))
        .catch(() => setStatus(null))
        .finally(() => setChecking(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [username]);

  return (
    <label className={labelClass}>
      {t("auth.register.username")}
      <div className="relative mt-1.5">
        <AtSign className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
        <input
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
          placeholder={t("auth.register.usernamePlaceholder")}
          aria-invalid={status ? !status.available : undefined}
          className={`${fieldClass} pl-9 pr-9 normal-case tracking-normal`}
        />
        <span className="absolute right-3 top-3">
          {checking ? <Loader2 className="h-4 w-4 animate-spin text-zinc-500" /> : status?.available ? <Check className="h-4 w-4 text-success" /> : null}
        </span>
      </div>
      <span className="mt-1 block min-h-4 text-[11px] font-normal normal-case tracking-normal">
        {status && !status.available && status.suggestion ? (
          <span className="text-warning">
            {status.reason === "format"
              ? t("auth.register.usernameFormat")
              : t(status.reason === "reserved" ? "auth.register.usernameReserved" : "auth.register.usernameTaken", { suggestion: `@${status.suggestion}` })}{" "}
            {status.reason !== "format" && (
              <button type="button" onClick={() => onChange(status.suggestion!)} className="font-semibold text-accent underline">
                {t("auth.register.useSuggestion")}
              </button>
            )}
          </span>
        ) : (
          <span className="text-zinc-500">
            {status?.available ? `${t("auth.register.usernameFree")} · ` : ""}
            {t("auth.register.usernameHint", { username: username || "username" })}
          </span>
        )}
      </span>
    </label>
  );
}
