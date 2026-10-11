import { formatMoney } from "@krizaka/intl/money";
import { formatCompact } from "@krizaka/intl/number";

import { currentLocale } from "@/lib/i18n";

/**
 * An amount of US cents as text in the reader's locale — `money(123450)` → `$1,234.50`. Amounts stay integers of
 * minor units from the database to the screen; only this function turns them into text (@krizaka/intl, study §2.10).
 */
export const money = (cents: number) => formatMoney(cents, { currency: "USD", locale: currentLocale() });

/** A count in short form — `compact(12345)` → `12.3K`. */
export const compact = (n: number) => formatCompact(n, { locale: currentLocale() });

const STEPS = [500, 1000, 2500, 5000];

/**
 * The four amounts a payment dialog offers: the creator's minimum first when there is one (an $8 unlock offers $8,
 * selected), then the usual steps above it — never an amount below the minimum.
 */
export function amountChoices(minimumCents: number): { cents: number }[] {
  const steps = minimumCents > 100 ? [minimumCents, ...STEPS.filter((c) => c > minimumCents)] : [...STEPS];
  while (steps.length < 4) steps.push(steps[steps.length - 1] * 2);
  return steps.slice(0, 4).map((cents) => ({ cents }));
}

/** @deprecated Since the move to @krizaka/intl — use `money`. */
export const usd = money;
