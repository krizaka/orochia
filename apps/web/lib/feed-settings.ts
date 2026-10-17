import { appSettings, db } from "@orochia/db";
import { addSeconds, isAfter } from "date-fns";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { FEED_RANK_DEFAULTS, type FeedRankSettings } from "./feed-ranking";

/**
 * The feed's parameters: the newest version of the `feed` domain of `app_settings`, each one inside its bounds, cached for a
 * minute (a published version reaches every instance within it). A key the version leaves out keeps its default
 * ({@link FEED_RANK_DEFAULTS}); a version outside the bounds is ignored whole, never half-applied.
 */
export const FEED_SETTINGS_DOMAIN = "feed";

const d = FEED_RANK_DEFAULTS;
export const FeedSettingsSchema = z.object({
  maxConsecutivePerCreator: z.number().int().min(1).max(10).default(d.maxConsecutivePerCreator),
  trendingShare: z.number().min(0).max(1).default(d.trendingShare),
  velocityWindowHours: z.number().int().min(6).max(168).default(d.velocityWindowHours),
  velocityHalfLifeHours: z.number().min(1).max(72).default(d.velocityHalfLifeHours),
  forYouHalfLifeHours: z.number().min(1).max(720).default(d.forYouHalfLifeHours),
  forYouRecencyFloor: z.number().min(0).max(1).default(d.forYouRecencyFloor),
  poolSize: z.number().int().min(24).max(500).default(d.poolSize),
  poolCacheSeconds: z.number().int().min(0).max(600).default(d.poolCacheSeconds),
  shortsMaxSeconds: z.number().int().min(10).max(600).default(d.shortsMaxSeconds),
  skipBelowPct: z.number().int().min(1).max(90).default(d.skipBelowPct),
  minDwellMs: z.number().int().min(0).max(10_000).default(d.minDwellMs),
});

/** What a stored version means: its keys over the defaults, or the defaults when it is not valid. */
export function parseFeedSettings(stored: unknown): FeedRankSettings {
  const parsed = FeedSettingsSchema.safeParse(stored ?? {});
  return parsed.success ? parsed.data : FEED_RANK_DEFAULTS;
}

// @fixed: a technical cache lifetime, not a business parameter
const CACHE_SECONDS = 60;
const holder = globalThis as unknown as { __orochiaFeedSettings?: { value: FeedRankSettings; until: Date } };

export async function feedSettings(now: Date): Promise<FeedRankSettings> {
  const cached = holder.__orochiaFeedSettings;
  if (cached && isAfter(cached.until, now)) return cached.value;
  const [row] = await db
    .select({ settings: appSettings.settings })
    .from(appSettings)
    .where(eq(appSettings.domain, FEED_SETTINGS_DOMAIN))
    .orderBy(desc(appSettings.version))
    .limit(1);
  const value = parseFeedSettings(row?.settings);
  holder.__orochiaFeedSettings = { value, until: addSeconds(now, CACHE_SECONDS) };
  return value;
}
