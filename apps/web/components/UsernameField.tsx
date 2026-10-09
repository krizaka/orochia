"use client";

import { AtSign, Check } from "lucide-react";
import React, { useEffect, useId, useState } from "react";

import { Field, Input, Spinner } from "@/components/ui";
import { t } from "@/lib/i18n";

type Status = { available: boolean; reason?: "format" | "reserved" | "taken"; suggestion?: string } | null;

/**
 * The username at sign-up: it is the account's public address (orochia.com/@username) and unique, so it is checked
 * while typing and a free one is offered when it is taken (two "Oussama Abid" → @oussama_abid, @oussama_abid2).
 */
export function UsernameField({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const id = useId();
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

  const taken = Boolean(status && !status.available && status.suggestion);

  return (
    <Field.Root className={className}>
      <Field.Label htmlFor={id} className="uppercase tracking-wider">
        {t("auth.register.username")}
      </Field.Label>
      <div className="relative">
        <AtSign className="absolute left-3 top-3.5 h-4 w-4 text-fg-muted" aria-hidden />
        <Input
          id={id}
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
          placeholder={t("auth.register.usernamePlaceholder")}
          invalid={status ? !status.available : undefined}
          aria-describedby={`${id}-help`}
          className="rounded-xl pl-9 pr-9"
        />
        <span className="absolute right-3 top-3.5">
          {checking ? <Spinner size="sm" className="text-fg-muted" /> : status?.available ? <Check className="h-4 w-4 text-success" aria-hidden /> : null}
        </span>
      </div>
      {taken && status ? (
        <Field.Error id={`${id}-help`} className="min-h-4 text-[11px]">
          <span>
            {status.reason === "format"
              ? t("auth.register.usernameFormat")
              : t(status.reason === "reserved" ? "auth.register.usernameReserved" : "auth.register.usernameTaken", { suggestion: `@${status.suggestion}` })}{" "}
            {status.reason !== "format" && (
              <button type="button" onClick={() => onChange(status.suggestion!)} className="font-semibold text-accent underline">
                {t("auth.register.useSuggestion")}
              </button>
            )}
          </span>
        </Field.Error>
      ) : (
        <Field.Hint id={`${id}-help`} className="min-h-4 text-[11px]">
          {status?.available ? `${t("auth.register.usernameFree")} · ` : ""}
          {t("auth.register.usernameHint", { username: username || "username" })}
        </Field.Hint>
      )}
    </Field.Root>
  );
}
