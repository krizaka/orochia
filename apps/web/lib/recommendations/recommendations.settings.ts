import { appSettings, db } from "@orochia/db";
import { addMinutes, isAfter } from "date-fns";
import { desc, eq } from "drizzle-orm";

import { RECOMMENDATIONS_SETTINGS_DOMAIN, type RecommendationSettings, RecommendationSettingsSchema } from "./recommendations.types";

/**
 * The feature's settings: the newest version of the `recommendations` domain of `app_settings`, parsed against its
 * bounds, cached for a minute (a published version reaches every instance within it, no redeploy). No version, or one
 * outside the bounds: the feature is off — never a guess.
 */
// @fixed: a technical cache lifetime, not a business parameter
const CACHE_MINUTES = 1;
const holder = globalThis as unknown as { __orochiaRecoSettings?: { value: RecommendationSettings | null; until: Date } };

export async function recommendationSettings(now: Date): Promise<RecommendationSettings | null> {
  const cached = holder.__orochiaRecoSettings;
  if (cached && isAfter(cached.until, now)) return cached.value;
  const [row] = await db
    .select({ settings: appSettings.settings, version: appSettings.version })
    .from(appSettings)
    .where(eq(appSettings.domain, RECOMMENDATIONS_SETTINGS_DOMAIN))
    .orderBy(desc(appSettings.version))
    .limit(1);
  const parsed = row ? RecommendationSettingsSchema.safeParse(row.settings) : null;
  if (parsed && !parsed.success) console.error(`[recommendations] app_settings v${row?.version} is outside its bounds — feature off`);
  const value = parsed?.success ? parsed.data : null;
  holder.__orochiaRecoSettings = { value, until: addMinutes(now, CACHE_MINUTES) };
  return value;
}

/** Test hook. */
export function forgetCachedSettings(): void {
  holder.__orochiaRecoSettings = undefined;
}
