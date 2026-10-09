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

/** @deprecated Since the move to @krizaka/intl — use `money`. */
export const usd = money;
