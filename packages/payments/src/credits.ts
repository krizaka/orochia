/**
 * Orochia credits — the in-house way to pay: a buyer tops up a balance, then spends it on tips and
 * unlocks, settled through the same payment intent → settlement → ledger path as any gateway.
 *
 * THE WALLET IS NOT BUILT YET. Until it is, the charge below approves every payment, and only when the
 * deployment says so explicitly: PAYMENTS_CREDITS_MODE=always-approve (dev and test environments).
 * Without it credits are not offered at all — a production server never unlocks for free by accident.
 * Replacing `chargeCredits` with a real balance check (and a top-up flow) is the whole migration.
 */

type Env = Record<string, string | undefined>;

export function creditsEnabled(env: Env = process.env): boolean {
  return env.PAYMENTS_CREDITS_MODE === "always-approve";
}

export interface CreditsCharge {
  approved: boolean;
  /** The reference the ledger records (unique per intent). */
  reference: string;
}

/** Charges a buyer's credits for an intent. For now: approved whenever credits are enabled. */
export async function chargeCredits(input: { intentId: string; buyerId: string; amountCents: number }, env: Env = process.env): Promise<CreditsCharge> {
  if (!creditsEnabled(env)) return { approved: false, reference: `credits_${input.intentId}` };
  return { approved: true, reference: `credits_${input.intentId}` };
}
