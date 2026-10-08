"use client";

import React from "react";
import { Cake } from "lucide-react";
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
export function BirthDateField({ value, onChange, labelClass, fieldClass }: { value: string; onChange: (v: string) => void; labelClass: string; fieldClass: string }) {
  return (
    <label className={labelClass}>
      {t("auth.register.birthDate")}
      <div className="relative mt-1.5">
        <Cake className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
        <input
          type="date"
          required
          autoComplete="bday"
          min="1900-01-01"
          max={latestAdultBirthDate()}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${fieldClass} pl-10 pr-4 normal-case tracking-normal scheme-dark light:scheme-light`}
        />
      </div>
      <span className="mt-1 block text-[11px] font-normal normal-case tracking-normal text-zinc-500">{t("auth.register.birthDateHint")}</span>
    </label>
  );
}
