import type { AppConfigRecord, Platform } from "@krizaka/app-config";
import { type AppConfigStore, cachedStore } from "@krizaka/app-config/server";
import { appConfig, db } from "@orochia/db";
import { eq } from "drizzle-orm";

type Row = typeof appConfig.$inferSelect;

/** A database row as the contract's record (the dates as ISO text, the texts as `{ language: text }`). */
export function recordOf(row: Row): AppConfigRecord {
  return {
    platform: row.platform as Platform,
    minSupportedVersion: row.minSupportedVersion,
    latestVersion: row.latestVersion,
    updateOverride: (row.updateOverride as AppConfigRecord["updateOverride"]) ?? null,
    storeUrl: row.storeUrl,
    maintenanceOn: row.maintenanceOn,
    maintenanceMessage: row.maintenanceMessage as Record<string, string>,
    message: row.message as Record<string, string>,
    contractMin: row.contractMin,
    contractMax: row.contractMax,
    contractSunset: row.contractSunset,
    flags: row.flags as AppConfigRecord["flags"],
    revision: row.revision,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}

const databaseStore: AppConfigStore = {
  async get(platform) {
    const [row] = await db.select().from(appConfig).where(eq(appConfig.platform, platform)).limit(1);
    return row ? recordOf(row) : undefined;
  },
};

/** The parameters, read from `app_config` and kept 30 s so a launch storm does not reach the database. */
export const appConfigStore = cachedStore(databaseStore, { ttlMs: 30_000 });
