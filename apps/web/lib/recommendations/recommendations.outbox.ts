import { db, paymentIntents, recoOutbox } from "@orochia/db";
import { addDays, addSeconds } from "date-fns";
import { and, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";

import { pseudonymKey } from "../env";
import { orazakaConfigured, OrazakaUnavailableError } from "../orazaka";
import { sendErasure, sendEvents } from "./recommendations.client";
import { type Interaction, toErasure, toRecoEvent } from "./recommendations.events";
import { type Pseudonym, type RecoEvent, RecoEventKind, type RecommendationSettings, RecoOutboxKind } from "./recommendations.types";

/**
 * The outbox to Orazaka's recommender (ADR-078 §6): an interaction is written here in the same transaction as the action
 * itself, and a background loop sends what is pending — batched, at least once (Orazaka ignores a known id), retried with
 * a doubling delay. No broker: PostgreSQL and `FOR UPDATE SKIP LOCKED` share the work between instances.
 *
 * Nothing is written while Orazaka or the pseudonym key is not configured: the outbox never grows for nobody.
 */
type Executor = Pick<typeof db, "insert">;

/** Records an interaction for the recommender (in the caller's transaction when it passes one). */
export async function enqueueInteraction(exec: Executor, interaction: Interaction, dedupKey?: string): Promise<void> {
  const key = pseudonymKey();
  if (!key || !orazakaConfigured()) return;
  const event = toRecoEvent(interaction, key);
  await exec
    .insert(recoOutbox)
    .values({ id: event.id, dedupKey: dedupKey ?? null, kind: RecoOutboxKind.Event, payload: event })
    .onConflictDoNothing();
}

/** Records people and videos the recommender must forget (an account deleted, a video out of discovery). */
export async function enqueueErasure(exec: Executor, accountIds: string[], videoIds: string[]): Promise<void> {
  const key = pseudonymKey();
  if (!key || !orazakaConfigured() || (accountIds.length === 0 && videoIds.length === 0)) return;
  await exec.insert(recoOutbox).values({ kind: RecoOutboxKind.Erasure, payload: toErasure(accountIds, videoIds, key) });
}

/** The delay before attempt `attempts + 1`: doubling from the base, capped. */
export function retryDelaySeconds(attempts: number, settings: Pick<RecommendationSettings, "retryBaseSeconds" | "retryMaxSeconds">): number {
  return Math.min(settings.retryMaxSeconds, settings.retryBaseSeconds * 2 ** Math.max(0, attempts));
}

// @fixed: how long a claimed row is hidden from the other instances while it is being sent — a technical lease
const LEASE_SECONDS = 120;

export interface DrainSummary {
  sent: number;
  erased: number;
  failed: number;
  requestCode: string | null;
}

type Claimed = {
  id: string;
  kind: RecoOutboxKind;
  payload: unknown;
  attempts: number;
};

/** One round: claims a batch, sends events in one call and each erasure in its own, records the outcome, prunes. */
export async function drainOutbox(now: Date, settings: RecommendationSettings): Promise<DrainSummary> {
  const claimed = await db.execute<Claimed>(sql`
    update reco_outbox set next_attempt_at = ${addSeconds(now, LEASE_SECONDS)}
    where id in (
      select id from reco_outbox
      where sent_at is null and next_attempt_at <= ${now} and attempts < ${settings.maxAttempts}
      order by created_at
      limit ${settings.outboxBatch}
      for update skip locked)
    returning id, kind, payload, attempts`);
  const rows = claimed.rows;
  const summary: DrainSummary = { sent: 0, erased: 0, failed: 0, requestCode: null };

  const events = rows.filter((r) => r.kind === RecoOutboxKind.Event);
  if (events.length > 0) {
    try {
      await sendEvents(events.map((r) => r.payload as RecoEvent), settings.syncTimeoutMs);
      await markSent(events.map((r) => r.id), now);
      summary.sent = events.length;
    } catch (error) {
      summary.failed += events.length;
      summary.requestCode = failureCode(error);
      await markFailed(events, now, settings, summary.requestCode);
    }
  }
  for (const erasure of rows.filter((r) => r.kind === RecoOutboxKind.Erasure)) {
    try {
      await sendErasure(erasure.payload as { users: Pseudonym[]; items: string[] }, settings.syncTimeoutMs);
      await markSent([erasure.id], now);
      summary.erased += 1;
    } catch (error) {
      summary.failed += 1;
      summary.requestCode = failureCode(error);
      await markFailed([erasure], now, settings, summary.requestCode);
    }
  }
  await db.delete(recoOutbox).where(and(isNotNull(recoOutbox.sentAt), lt(recoOutbox.sentAt, addDays(now, -settings.sentRetentionDays))));
  return summary;
}

function failureCode(error: unknown): string {
  return error instanceof OrazakaUnavailableError ? error.code : "error";
}

async function markSent(ids: string[], now: Date) {
  await db.update(recoOutbox).set({ sentAt: now, lastError: null }).where(inArray(recoOutbox.id, ids));
}

async function markFailed(rows: Claimed[], now: Date, settings: RecommendationSettings, code: string) {
  for (const row of rows) {
    await db
      .update(recoOutbox)
      .set({ attempts: row.attempts + 1, nextAttemptAt: addSeconds(now, retryDelaySeconds(row.attempts, settings)), lastError: code })
      .where(inArray(recoOutbox.id, [row.id]));
  }
}

/**
 * A settled payment on a video is a strong signal: an unlock, or a tip. Called after the settlement (never inside the
 * gateway's transaction); idempotent by the payment intent (`dedupKey`), so a webhook delivered twice is one event.
 */
export async function enqueueSettlement(intentId: string, unlocked: boolean, at: Date): Promise<void> {
  const [intent] = await db
    .select({ senderId: paymentIntents.senderId, creatorId: paymentIntents.creatorId, videoId: paymentIntents.videoId })
    .from(paymentIntents)
    .where(eq(paymentIntents.id, intentId))
    .limit(1);
  if (!intent?.senderId || !intent.videoId || intent.senderId === intent.creatorId) return;
  await enqueueInteraction(
    db,
    { accountId: intent.senderId, videoId: intent.videoId, creatorId: intent.creatorId, kind: unlocked ? RecoEventKind.Unlock : RecoEventKind.Tip, at },
    `settlement:${intentId}`,
  );
}
