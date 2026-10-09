"use client";

import React, { useState } from "react";
import { money } from "@/lib/money";

/**
 * Net earnings per month — one series, so one hue and no legend (the heading names it). Bars sit on the baseline with
 * rounded tops and a gap between them; hovering (or focusing) a bar shows its month and amount; a visually hidden table
 * carries the same numbers for screen readers.
 */
export function MonthlyChart({ data, label }: { data: { month: string; netCents: number }[]; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.netCents));
  const monthName = (m: string, style: "short" | "long" = "short") => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-US", { month: style, year: style === "long" ? "numeric" : undefined, timeZone: "UTC" });
  const current = active !== null ? data[active] : null;

  return (
    <figure className="relative">
      <div className="mb-2 h-5 text-xs text-fg-secondary" aria-live="polite">
        {current && (
          <span>
            <span className="font-semibold text-fg">{money(current.netCents)}</span> · {monthName(current.month, "long")}
          </span>
        )}
      </div>
      <div className="flex h-40 items-end gap-[2px] border-b border-border-default" onMouseLeave={() => setActive(null)}>
        {data.map((d, i) => {
          const h = d.netCents > 0 ? Math.max(3, (d.netCents / max) * 100) : 0;
          return (
            <button
              key={d.month}
              type="button"
              aria-label={`${monthName(d.month, "long")}: ${money(d.netCents)}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="group relative flex h-full flex-1 items-end justify-center focus-visible:outline-hidden"
            >
              <span
                className={`block w-full max-w-[28px] rounded-t-[4px] bg-accent transition-opacity ${active === null || active === i ? "opacity-100" : "opacity-40"} group-focus-visible:ring-2 group-focus-visible:ring-ring`}
                style={{ height: `${h}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[2px] text-center text-[10px] text-fg-muted">
        {data.map((d, i) => (
          <span key={d.month} className={`flex-1 ${i % 2 === 1 ? "invisible sm:visible" : ""}`}>
            {monthName(d.month)}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <th scope="row">{monthName(d.month, "long")}</th>
              <td>{money(d.netCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
