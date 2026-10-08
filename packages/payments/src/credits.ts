import { db, creditTopups, walletLedger } from "@orochia/db";
import { desc, eq, sql } from "drizzle-orm";
import type { GatewayType, ParsedPaymentEvent } from "./types";

/**
 * Orochia credits — the wallet. 1 credit = 1 US cent. An account tops up through a gateway's hosted checkout (card,
 * Apple Pay, Google Pay — card details never reach Orochia), the gateway's signed webhook settles the top-up exactly
 * once, and credits are spent on tips and unlocks through the usual intent → settlement → ledger path.
 *
 * The balance is the sum of `wallet_ledger` (append-only). Spending is serialised per account (advisory lock) and
 * idempotent per payment intent; a spend whose settlement does not complete is refunded.
 *
 * Test top-ups (no gateway, no money): PAYMENTS_CREDITS_MODE=test — never on the indexed (public production) deployment.
 */

type Env = Record<string, string | undefined>;
type Executor = Pick<typeof db, "select" | "insert" | "update" | "execute">;

/** Credit packs offered; larger packs carry bonus credits. */
export const CREDIT_PACKS = [
  { id: "starter", priceCents: 1000, creditsCents: 1000 },
  { id: "plus", priceCents: 2500, creditsCents: 2600 },
  { id: "pro", priceCents: 5000, creditsCents: 5400 },
  { id: "max", priceCents: 10000, creditsCents: 11000 },
] as const;
export type CreditPackId = (typeof CREDIT_PACKS)[number]["id"];

/** Credits are always a way to pay: the balance decides. */
export function creditsEnabled(_env: Env = process.env): boolean {
  return true;
}

/**
 * Top-ups that add credits without a payment — local, CI and the dev deployment. Never on the public production
 * deployment: one that search engines index (SEARCH_INDEXING not "off") ignores the setting, whatever it says.
 */
export function testTopupsEnabled(env: Env = process.env): boolean {
  const asked = env.PAYMENTS_CREDITS_MODE === "test" || env.PAYMENTS_CREDITS_MODE === "always-approve";
  const publicProduction = env.NODE_ENV === "production" && env.SEARCH_INDEXING !== "off";
  return asked && !publicProduction;
}

export async function getWalletBalanceCents(userId: string, executor: Executor = db): Promise<number> {
  const [row] = await executor
    .select({ total: sql<string>`coalesce(sum(${walletLedger.amountCents}), 0)` })
    .from(walletLedger)
    .where(eq(walletLedger.userId, userId));
  return Number(row?.total ?? 0);
}

export async function walletHistory(userId: string, limit = 50) {
  return db.select().from(walletLedger).where(eq(walletLedger.userId, userId)).orderBy(desc(walletLedger.createdAt)).limit(limit);
}

/** Records a top-up waiting for its payment. */
export async function createTopup(userId: string, packId: CreditPackId, gateway: GatewayType) {
  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) throw new Error("Unknown credit pack");
  const [row] = await db.insert(creditTopups).values({ userId, creditsCents: pack.creditsCents, priceCents: pack.priceCents, gateway }).returning();
  return row;
}

export type TopupOutcome = { kind: "SETTLED"; creditsCents: number } | { kind: "ALREADY_SETTLED" } | { kind: "FAILED" } | { kind: "PENDING" } | { kind: "UNKNOWN_TOPUP" } | { kind: "GATEWAY_MISMATCH" } | { kind: "UNDERPAID" };

/** Applies a verified gateway event to a top-up, exactly once (the row is locked for the settlement). */
export async function settleTopup(gateway: GatewayType, event: ParsedPaymentEvent): Promise<TopupOutcome> {
  return db.transaction(async (tx) => {
    const [topup] = await tx.select().from(creditTopups).where(eq(creditTopups.id, event.intentId)).for("update").limit(1);
    if (!topup) return { kind: "UNKNOWN_TOPUP" } as const;
    if (topup.gateway !== gateway) return { kind: "GATEWAY_MISMATCH" } as const;
    if (topup.status === "SUCCEEDED") return { kind: "ALREADY_SETTLED" } as const;
    if (event.status === "PENDING") return { kind: "PENDING" } as const;
    if (event.status === "FAILED") {
      await tx.update(creditTopups).set({ status: "FAILED", settledAt: new Date() }).where(eq(creditTopups.id, topup.id));
      return { kind: "FAILED" } as const;
    }
    if (event.amountCents < topup.priceCents) return { kind: "UNDERPAID" } as const;
    await tx.insert(walletLedger).values({ userId: topup.userId, entryType: "TOPUP", amountCents: topup.creditsCents, reference: `topup_${topup.id}`, note: `Top-up via ${gateway}` });
    await tx.update(creditTopups).set({ status: "SUCCEEDED", gatewayTransactionRef: event.gatewayTransactionRef, settledAt: new Date() }).where(eq(creditTopups.id, topup.id));
    return { kind: "SETTLED", creditsCents: topup.creditsCents } as const;
  });
}

export interface CreditsCharge {
  approved: boolean;
  /** The reference the ledger records (unique per intent). */
  reference: string;
  balanceCents?: number;
}

/** Spends credits for a payment intent: approved when the balance covers it; idempotent per intent. */
export async function chargeCredits(input: { intentId: string; buyerId: string; amountCents: number }): Promise<CreditsCharge> {
  const reference = `spend_${input.intentId}`;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`wallet:${input.buyerId}`}))`);
    const [already] = await tx.select({ id: walletLedger.id }).from(walletLedger).where(eq(walletLedger.reference, reference)).limit(1);
    if (already) return { approved: true, reference };
    const balance = await getWalletBalanceCents(input.buyerId, tx);
    if (balance < input.amountCents) return { approved: false, reference, balanceCents: balance };
    await tx.insert(walletLedger).values({ userId: input.buyerId, entryType: "SPEND", amountCents: -input.amountCents, reference, note: "Payment" });
    return { approved: true, reference, balanceCents: balance - input.amountCents };
  });
}

/** Gives back credits spent for an intent whose settlement did not complete (once). */
export async function refundCredits(input: { intentId: string; buyerId: string; amountCents: number }) {
  await db
    .insert(walletLedger)
    .values({ userId: input.buyerId, entryType: "REFUND", amountCents: input.amountCents, reference: `refund_${input.intentId}`, note: "Refund" })
    .onConflictDoNothing();
}

/** Adds credits without a payment (test environments only — see testTopupsEnabled). */
export async function grantTestTopup(userId: string, packId: CreditPackId, env: Env = process.env) {
  if (!testTopupsEnabled(env)) throw new Error("Test top-ups are disabled");
  const topup = await createTopup(userId, packId, "CREDITS");
  return settleTopup("CREDITS", { intentId: topup.id, gatewayTransactionRef: `test_${topup.id}`, amountCents: topup.priceCents, status: "SUCCESS" });
}

