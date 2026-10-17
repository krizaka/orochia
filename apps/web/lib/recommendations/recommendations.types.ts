import type { recoOutboxKindEnum } from "@orochia/db";
import { z } from "zod";

/**
 * The recommendations feature's types and schemas (ADR-078): what Orochia sends to Orazaka, what it accepts back, and its
 * own versioned settings — parsed once, at the edge, then trusted.
 */

/** What a person did (the `reco_event_kind` values, sent as the event's `kind`). */
export const RecoEventKind = {
  View: "VIEW",
  Like: "LIKE",
  Save: "SAVE",
  Share: "SHARE",
  Tip: "TIP",
  Unlock: "UNLOCK",
  Follow: "FOLLOW",
  Unfollow: "UNFOLLOW",
  Skip: "SKIP",
  Report: "REPORT",
} as const;
export type RecoEventKind = (typeof RecoEventKind)[keyof typeof RecoEventKind];

/** What an outbox row carries (the `reco_outbox_kind` values). */
export const RecoOutboxKind = { Event: "EVENT", Erasure: "ERASURE", Analytics: "ANALYTICS" } as const satisfies Record<string, (typeof recoOutboxKindEnum.enumValues)[number]>;
export type RecoOutboxKind = (typeof RecoOutboxKind)[keyof typeof RecoOutboxKind];

/** Why Orazaka put an item in a feed — the reason Orochia may show ("because you liked…"). */
export const RecoReason = { Similar: "similar", CoEngaged: "co_engaged", Fresh: "fresh", Followed: "followed", Popular: "popular" } as const;
export type RecoReason = (typeof RecoReason)[keyof typeof RecoReason];

/** Where a shelf's videos came from: Orazaka, or Orochia's own non-AI answer. */
export const ShelfSource = { Orazaka: "orazaka", Fallback: "fallback" } as const;
export type ShelfSource = (typeof ShelfSource)[keyof typeof ShelfSource];

/** A person as Orazaka knows them: an HMAC of the account id, never the id itself (Loi 25). */
export type Pseudonym = string & { readonly __brand: "Pseudonym" };

/** One event as it leaves for Orazaka (`POST /api/v1/recommendations/events`). */
export interface RecoEvent {
  id: string;
  user: Pseudonym;
  item: string | null;
  creator: string | null;
  kind: RecoEventKind;
  watchedPct: number | null;
  at: string;
}

/** One eligible video as it leaves for Orazaka (`POST /api/v1/recommendations/items`) — public metadata only. */
export interface RecoItem {
  id: string;
  creator: string;
  title: string;
  description: string;
  tags: string[];
  language: string | null;
  durationSeconds: number | null;
  publishedAt: string;
}

// ── Orazaka's answers (the recorded contract: recommendations-contract.json) ──────────────────

export const IngestResultSchema = z.object({ accepted: z.number().int().nonnegative(), duplicates: z.number().int().nonnegative() });
export const CatalogueResultSchema = z.object({
  upserted: z.number().int().nonnegative(),
  embedded: z.number().int().nonnegative(),
  model: z.string().nullable(),
  runId: z.string().nullable(),
});
export const ErasureResultSchema = z.object({ events: z.number().int().nonnegative(), items: z.number().int().nonnegative() });

export const FeedSchema = z.object({
  requestId: z.string().uuid(),
  strategy: z.enum(["personal", "cold_start", "similar"]),
  candidates: z.number().int().nonnegative(),
  items: z.array(
    z.object({
      id: z.string().min(1),
      score: z.number(),
      reasons: z.array(z.enum([RecoReason.Similar, RecoReason.CoEngaged, RecoReason.Fresh, RecoReason.Followed, RecoReason.Popular])),
    }),
  ),
});
export type Feed = z.infer<typeof FeedSchema>;

export const InsightsSchema = z.object({
  creatorId: z.string(),
  minAudience: z.number().int().positive(),
  items: z.array(
    z.object({
      itemId: z.string(),
      views: z.number().int().nonnegative(),
      engagements: z.number().int().nonnegative(),
      skips: z.number().int().nonnegative(),
      engagementRate: z.number().nonnegative(),
      avgWatchedPct: z.number().nullable(),
    }),
  ),
  tags: z.array(
    z.object({
      tag: z.string(),
      items: z.number().int().nonnegative(),
      views: z.number().int().nonnegative(),
      engagements: z.number().int().nonnegative(),
      engagementRate: z.number().nonnegative(),
    }),
  ),
  bestHours: z.array(z.object({ isoDayOfWeek: z.number().int().min(1).max(7), hour: z.number().int().min(0).max(23), engagements: z.number().int().nonnegative() })),
  alsoWatched: z.array(z.object({ creatorId: z.string(), sharedAudience: z.number().int().nonnegative() })),
});
export type Insights = z.infer<typeof InsightsSchema>;

// ── Orochia's settings (app_settings, domain "recommendations") ───────────────────────────────

/** The settings domain of this feature in `app_settings`. */
export const RECOMMENDATIONS_SETTINGS_DOMAIN = "recommendations";

/**
 * The parameters of the recommendations feature. Version 1 is seeded by the migration (switched off); an operator
 * publishes a new version with a reason. The bounds are the safety rails a version must stay inside.
 */
export const RecommendationSettingsSchema = z.object({
  /** The shelves call Orazaka; off, they show Orochia's own answer (and the outbox still fills — nothing is lost). */
  enabled: z.boolean(),
  /** How long a shelf waits for Orazaka before it falls back. */
  timeoutMs: z.number().int().min(100).max(5_000),
  /** How long a background call (events, items, erasures) may take. */
  syncTimeoutMs: z.number().int().min(1_000).max(60_000),
  forYouLimit: z.number().int().min(1).max(50),
  similarLimit: z.number().int().min(1).max(24),
  /** Outbox rows sent per round, and the round's period. */
  outboxBatch: z.number().int().min(1).max(500),
  outboxIntervalSeconds: z.number().int().min(5).max(3_600),
  /** A row is retried with a doubling delay from `retryBaseSeconds`, capped at `retryMaxSeconds`, `maxAttempts` times. */
  retryBaseSeconds: z.number().int().min(1).max(3_600),
  retryMaxSeconds: z.number().int().min(60).max(86_400),
  maxAttempts: z.number().int().min(1).max(100),
  /** Sent rows are kept this long (the operator's proof), then pruned. */
  sentRetentionDays: z.number().int().min(1).max(90),
  /** The catalogue reconciler: its period and its batch. */
  catalogueIntervalSeconds: z.number().int().min(30).max(86_400),
  catalogueBatch: z.number().int().min(1).max(100),
  /** Leaving a video within this many seconds, below `skipBelowPct` watched, is a skip (ADR-081). */
  skipWithinSeconds: z.number().int().min(1).max(30).default(3),
  skipBelowPct: z.number().int().min(1).max(50).default(20),
  /** The creator's audience page: its period, and the funnel it draws (kinds of Orazaka's analytics). */
  audienceDays: z.number().int().min(7).max(366).default(28),
  audienceFunnel: z.array(z.string().regex(/^[a-z][a-z0-9_]{1,31}$/)).min(2).max(6).default(["view", "like", "tip"]),
});
export type RecommendationSettings = z.infer<typeof RecommendationSettingsSchema>;
