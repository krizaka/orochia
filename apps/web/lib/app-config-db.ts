import type { AppConfigRecord } from "@krizaka/app-config";
import { appConfig, appConfigHistory, db } from "@orochia/db";
import { and, desc, eq } from "drizzle-orm";

import { appConfigStore, recordOf } from "./app-config";
import { nextRevision,type PublishBody } from "./app-config-admin";

/** The database side of the operator's publish and rollback (the rules are in `app-config-admin.ts`). */
type Row = typeof appConfig.$inferSelect;
const columns = (r: AppConfigRecord) => ({
  minSupportedVersion: r.minSupportedVersion,
  latestVersion: r.latestVersion,
  updateOverride: r.updateOverride,
  storeUrl: r.storeUrl,
  maintenanceOn: r.maintenanceOn,
  maintenanceMessage: r.maintenanceMessage,
  message: r.message,
  contractMin: r.contractMin,
  contractMax: r.contractMax,
  contractSunset: r.contractSunset,
  flags: r.flags,
});

export async function listConfigs(): Promise<AppConfigRecord[]> {
  const rows: Row[] = await db.select().from(appConfig);
  return rows.map(recordOf);
}

export async function historyOf(platform: string) {
  const rows = await db.select().from(appConfigHistory).where(eq(appConfigHistory.platform, platform)).orderBy(desc(appConfigHistory.revision)).limit(50);
  return rows.map((h) => ({
    platform: h.platform,
    minSupportedVersion: h.minSupportedVersion,
    latestVersion: h.latestVersion,
    updateOverride: h.updateOverride,
    storeUrl: h.storeUrl,
    maintenanceOn: h.maintenanceOn,
    maintenanceMessage: h.maintenanceMessage,
    message: h.message,
    contractMin: h.contractMin,
    contractMax: h.contractMax,
    contractSunset: h.contractSunset,
    flags: h.flags,
    revision: h.revision,
    updatedAt: h.changedAt.toISOString(),
    updatedBy: h.changedBy,
    reason: h.reason,
    changedBy: h.changedBy,
    changedAt: h.changedAt.toISOString(),
  }));
}

/** Publishes as the next revision: the row and its history line in one transaction, the cache dropped. */
export async function publish(platform: string, value: PublishBody, by: string): Promise<AppConfigRecord> {
  const saved = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(appConfig).where(eq(appConfig.platform, platform)).for("update");
    const next = nextRevision(row ? recordOf(row) : undefined, value, by, new Date(), platform as AppConfigRecord["platform"]);
    await tx.insert(appConfig).values({ platform, ...columns(next), revision: next.revision, updatedAt: new Date(next.updatedAt), updatedBy: by }).onConflictDoUpdate({ target: appConfig.platform, set: { ...columns(next), revision: next.revision, updatedAt: new Date(next.updatedAt), updatedBy: by } });
    await tx.insert(appConfigHistory).values({ platform, revision: next.revision, ...columns(next), reason: value.reason, changedBy: by, changedAt: new Date(next.updatedAt) });
    return next;
  });
  appConfigStore.evict(platform as AppConfigRecord["platform"]);
  return saved;
}

/** The body that re-publishes an earlier revision, or null when that revision does not exist. */
export async function bodyOfRevision(platform: string, revision: number, reason: string): Promise<PublishBody | null> {
  const [h] = await db.select().from(appConfigHistory).where(and(eq(appConfigHistory.platform, platform), eq(appConfigHistory.revision, revision))).limit(1);
  if (!h) return null;
  return {
    minSupportedVersion: h.minSupportedVersion,
    latestVersion: h.latestVersion,
    updateOverride: h.updateOverride as PublishBody["updateOverride"],
    storeUrl: h.storeUrl,
    maintenanceOn: h.maintenanceOn,
    maintenanceMessage: h.maintenanceMessage as PublishBody["maintenanceMessage"],
    message: h.message as PublishBody["message"],
    contractMin: h.contractMin,
    contractMax: h.contractMax,
    contractSunset: h.contractSunset,
    flags: h.flags as PublishBody["flags"],
    reason: `rollback to revision ${revision}: ${reason}`.slice(0, 500),
  };
}
