import { formatMoney } from "@krizaka/intl/money";
import { formatCompact } from "@krizaka/intl/number";
import { getNumberFormat } from "@krizaka/intl";

import { intlLocale, type Locale } from "./locales";

/**
 * Amounts, counts, sizes, speeds and durations in the reader's language (Intl through @krizaka/intl). Amounts stay
 * integers of minor units from the database to the screen; only these functions turn them into text, and each one is
 * given the language — a screen gets them already bound from `useI18n()` / `getI18n()`.
 */

/** An amount of US cents — `money(123450, "en")` → `$1,234.50`, in French `1 234,50 $ US`. */
export const money = (cents: number, locale: Locale) => formatMoney(cents, { currency: "USD", locale: intlLocale(locale) });

/** A count in short form — `compact(12345, "en")` → `12.3K`. */
export const compact = (n: number, locale: Locale) => formatCompact(n, { locale: intlLocale(locale) });

const unit = (value: number, name: string, locale: Locale, digits = 1) =>
  getNumberFormat(intlLocale(locale), { style: "unit", unit: name, unitDisplay: "short", maximumFractionDigits: digits }).format(value);

/** A size in bytes, in the largest unit under 1024 of it (B · kB · MB · GB). */
export function bytes(n: number, locale: Locale): string {
  if (n >= 1024 ** 3) return unit(n / 1024 ** 3, "gigabyte", locale);
  if (n >= 1024 ** 2) return unit(n / 1024 ** 2, "megabyte", locale);
  if (n >= 1024) return unit(n / 1024, "kilobyte", locale, 0);
  return unit(Math.max(0, n), "byte", locale, 0);
}

/** A transfer speed in bytes per second (kB/s · MB/s); `null` when it is not known yet. */
export function speed(bytesPerSecond: number, locale: Locale): string | null {
  if (bytesPerSecond <= 0) return null;
  if (bytesPerSecond >= 1024 ** 2) return unit(bytesPerSecond / 1024 ** 2, "megabyte-per-second", locale);
  return unit(bytesPerSecond / 1024, "kilobyte-per-second", locale, 0);
}

/** A duration in whole seconds, the two largest units (`2 hr 5 min`, `1 min 35 sec`, `12 sec`); `null` when unknown. */
export function duration(seconds: number | null, locale: Locale): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  if (h > 0) return [unit(h, "hour", locale, 0), m ? unit(m, "minute", locale, 0) : ""].filter(Boolean).join(" ");
  if (m > 0) return [unit(m, "minute", locale, 0), rest ? unit(rest, "second", locale, 0) : ""].filter(Boolean).join(" ");
  return unit(rest, "second", locale, 0);
}

type When = string | number | Date;

const instant = (value: When) => (value instanceof Date ? value : new Date(value));

/** A whole number or a figure with its thousands separators — `12,345` in English, `12 345` in French. */
export const number = (n: number, locale: Locale) => n.toLocaleString(intlLocale(locale));

/** `Oct 17, 2026` · `17 oct. 2026`. */
export const date = (value: When, locale: Locale) => instant(value).toLocaleDateString(intlLocale(locale), { month: "short", day: "numeric", year: "numeric" });

/** `Oct 17` · `17 oct.`. */
export const dateShort = (value: When, locale: Locale) => instant(value).toLocaleDateString(intlLocale(locale), { month: "short", day: "numeric" });

/** `Oct 17, 3:05 PM` · `17 oct., 15 h 05`. */
export const dateTime = (value: When, locale: Locale) =>
  instant(value).toLocaleString(intlLocale(locale), { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** The hour and minutes of an instant: `03:05 PM` · `15 h 05`. */
export const clock = (value: When, locale: Locale) => instant(value).toLocaleTimeString(intlLocale(locale), { hour: "2-digit", minute: "2-digit" });

/** `in 3 minutes`, `5 min ago` — short and relative up to a week, then the date. */
export function timeAgo(value: When, locale: Locale): string {
  const at = instant(value);
  const s = (Date.now() - at.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto", style: "short" });
  if (s < 60) return rtf.format(-Math.round(s), "second");
  if (s < 3600) return rtf.format(-Math.round(s / 60), "minute");
  if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
  if (s < 604800) return rtf.format(-Math.round(s / 86400), "day");
  return dateShort(at, locale);
}
