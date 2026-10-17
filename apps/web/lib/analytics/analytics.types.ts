import { z } from "zod";

import type { Pseudonym } from "../recommendations/recommendations.types";

/**
 * Product analytics on Orazaka (ADR-081, krizaka/orazaka-packs): the events Orochia sends that are not recommender
 * events, and the insights it reads back for a creator. The recommender's events (view, like, tip, skip…) are read back
 * by Orazaka itself, so they are never sent twice.
 */
export const AnalyticsKind = { Watch: "watch" } as const;
export type AnalyticsKind = (typeof AnalyticsKind)[keyof typeof AnalyticsKind];

/** One event as it leaves for Orazaka (`POST /api/v1/analytics/events`). */
export interface AnalyticsEvent {
  id: string;
  subject: Pseudonym;
  kind: AnalyticsKind;
  item: string | null;
  owner: string | null;
  value: number | null;
  at: string;
}

const FigureSchema = z.object({ current: z.number().int().nonnegative(), previous: z.number().int().nonnegative(), change: z.number().nullable() });
const RangeSchema = z.object({ from: z.string(), to: z.string() });

export const AnalyticsInsightsSchema = z.object({
  range: RangeSchema,
  owner: z.string().nullable(),
  minAudience: z.number().int().positive(),
  suppressed: z.boolean(),
  events: FigureSchema.nullable(),
  activeSubjects: FigureSchema.nullable(),
  kinds: z.array(
    z.object({
      kind: z.string(),
      unit: z.enum(["NONE", "PERCENT", "SECONDS", "CENTS", "COUNT"]),
      count: FigureSchema,
      subjects: z.number().int().nonnegative(),
      valueSum: z.number().nullable(),
      valueMean: z.number().nullable(),
    }),
  ),
  series: z.array(
    z.object({ day: z.string(), suppressed: z.boolean(), activeSubjects: z.number().int().nullable(), events: z.record(z.string(), z.number().int()) }),
  ),
  topItems: z.array(
    z.object({
      itemId: z.string(),
      ownerId: z.string().nullable(),
      subjects: z.number().int(),
      engagements: z.number().int(),
      views: z.number().int(),
      meanWatchedPct: z.number().nullable(),
    }),
  ),
  cohorts: z.array(z.object({ week: z.string(), size: z.number().int(), retention: z.array(z.number()) })),
});
export type AnalyticsInsights = z.infer<typeof AnalyticsInsightsSchema>;

export const AnalyticsFunnelSchema = z.object({
  range: RangeSchema,
  owner: z.string().nullable(),
  windowHours: z.number().int(),
  minAudience: z.number().int(),
  steps: z.array(
    z.object({
      kind: z.string(),
      suppressed: z.boolean(),
      subjects: z.number().int().nullable(),
      fromPrevious: z.number().nullable(),
      fromFirst: z.number().nullable(),
    }),
  ),
});
export type AnalyticsFunnel = z.infer<typeof AnalyticsFunnelSchema>;

export const AnalyticsIngestResultSchema = z.object({ accepted: z.number().int().nonnegative(), duplicates: z.number().int().nonnegative() });
