"use client";

import { Cake } from "lucide-react";
import React, { useId } from "react";

import { Field, Input } from "@/components/ui";
import { t } from "@/lib/i18n";

/** The latest date of birth that is 18 today (YYYY-MM-DD), for the picker's limit. */
export function latestAdultBirthDate(today = new Date()): string {
  const d = new Date(Date.UTC(today.getFullYear() - 18, today.getMonth(), today.getDate()));
  return d.toISOString().slice(0, 10);
}

/** True when a YYYY-MM-DD date is at least 18 years ago (the server checks again). */
export function isAdultBirthDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value <= latestAdultBirthDate();
}

/** Date of birth at sign-up: private, never shown, checked 18+ by the server. */
export function BirthDateField({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const id = useId();
  return (
    <Field.Root className={className}>
      <Field.Label htmlFor={id} className="uppercase tracking-wider">
        {t("auth.register.birthDate")}
      </Field.Label>
      <div className="relative">
        <Cake className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-fg-muted" aria-hidden />
        <Input
          id={id}
          type="date"
          required
          autoComplete="bday"
          min="1900-01-01"
          max={latestAdultBirthDate()}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={`${id}-hint`}
          className="rounded-xl pl-10"
        />
      </div>
      <Field.Hint id={`${id}-hint`} className="text-[11px]">
        {t("auth.register.birthDateHint")}
      </Field.Hint>
    </Field.Root>
  );
}
