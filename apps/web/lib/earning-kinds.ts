/**
 * What a creator credit paid for, read from the note the settlement wrote on the ledger row (`packages/payments`:
 * "Video unlock", "Creator tip" / "Story tip", "Auction sale", "Challenge delivered"). Pure, shared by the read model
 * and the Earnings page.
 */
export const EARNING_KINDS = ["tip", "unlock", "auction", "challenge"] as const;
export type EarningKind = (typeof EARNING_KINDS)[number];

export function earningKind(note: string | null): EarningKind {
  const n = note ?? "";
  if (/auction/i.test(n)) return "auction";
  if (/challenge/i.test(n)) return "challenge";
  if (/unlock/i.test(n)) return "unlock";
  return "tip";
}
