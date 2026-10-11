import { getNumberFormat } from "@krizaka/intl";

import { currentLocale } from "@/lib/i18n";

/**
 * Sizes, speeds and durations in the reader's locale (Intl units through @krizaka/intl) — `bytes(1_572_864)` →
 * `1.5 MB`, `duration(95)` → `1 min 35 sec`. The upload dock and the quotas write them; no unit is spelt in code.
 */

const unit = (value: number, name: string, digits = 1) =>
  getNumberFormat(currentLocale(), { style: "unit", unit: name, unitDisplay: "short", maximumFractionDigits: digits }).format(value);

/** A size in bytes, in the largest unit under 1024 of it (B · kB · MB · GB). */
export function bytes(n: number): string {
  if (n >= 1024 ** 3) return unit(n / 1024 ** 3, "gigabyte");
  if (n >= 1024 ** 2) return unit(n / 1024 ** 2, "megabyte");
  if (n >= 1024) return unit(n / 1024, "kilobyte", 0);
  return unit(Math.max(0, n), "byte", 0);
}

/** A transfer speed in bytes per second (kB/s · MB/s); `null` when it is not known yet. */
export function speed(bytesPerSecond: number): string | null {
  if (bytesPerSecond <= 0) return null;
  if (bytesPerSecond >= 1024 ** 2) return unit(bytesPerSecond / 1024 ** 2, "megabyte-per-second");
  return unit(bytesPerSecond / 1024, "kilobyte-per-second", 0);
}

/** A duration in whole seconds, the two largest units (`2 hr 5 min`, `1 min 35 sec`, `12 sec`); `null` when unknown. */
export function duration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  if (h > 0) return [unit(h, "hour", 0), m ? unit(m, "minute", 0) : ""].filter(Boolean).join(" ");
  if (m > 0) return [unit(m, "minute", 0), rest ? unit(rest, "second", 0) : ""].filter(Boolean).join(" ");
  return unit(rest, "second", 0);
}
