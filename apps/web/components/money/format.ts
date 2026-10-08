const usdFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const compactFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** $1,234.50 */
export const usd = (cents: number) => usdFormat.format(cents / 100);
/** 12.3K */
export const compact = (n: number) => compactFormat.format(n);
