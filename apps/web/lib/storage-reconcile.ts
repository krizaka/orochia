import { db, storageSnapshots } from "@orochia/db";
import { BunnyStreamClient, type BunnyVideoResponse,getLibraryTotals, getStorageZoneTotals } from "@orochia/media";
import { differenceInMilliseconds } from "date-fns";
import { desc, sql } from "drizzle-orm";

import { bunnyStreamConfig } from "./env";
import { checkPlatformAlerts, platformUsage, releaseHeld, zeroRowsMissingFrom } from "./storage-usage";

/**
 * Reconciliation of the application's storage counters with Bunny — the periodic check behind the quotas
 * (lib/storage-usage.ts). It lists the Stream library (one request per 1000 videos), then:
 *
 * - sets every row's `storage_bytes` to Bunny's `storageSize`, and fills a missing length;
 * - zeroes rows whose video Bunny no longer has;
 * - counts the videos at Bunny that no row knows (orphans: an abandoned session, a manual upload, another environment
 *   sharing the library) — their bytes are added to the platform's usage until the next run;
 * - with `MEDIA_ACCOUNT_API_KEY`, records the library's and the storage zone's own totals;
 * - records a `storage_snapshots` row, re-checks the platform alerts and releases held files that fit again.
 *
 * Run by `npm run quota:reconcile`, by `POST /api/admin/storage` and by the background loop every
 * `ABUSE_QUOTA_RECONCILE_INTERVAL_MINUTES` (360; 0 turns it off). Nothing is ever deleted at Bunny.
 */
export interface ReconcileResult {
  snapshotId: string;
  libraryVideos: number;
  libraryBytes: number;
  librarySeconds: number;
  appBytes: number;
  orphanVideos: number;
  orphanBytes: number;
  missingVideos: number;
  updatedRows: number;
  zone: { bytes: number | null; files: number | null } | null;
  libraryTotals: { storageBytes: number | null; videoCount: number | null } | null;
  released: number;
  alerts: number[];
}

type Lister = Pick<BunnyStreamClient, "listAllVideos">;

/** Applies Bunny's figures to the three tables in one statement each (only the rows that differ). */
async function applyBunnySizes(items: BunnyVideoResponse[]): Promise<number> {
  if (items.length === 0) return 0;
  // One JSON parameter (not one per value): libraries of thousands of videos stay one statement per table.
  const rows = JSON.stringify(
    items.map((i) => ({ guid: i.guid, bytes: Math.max(0, Math.round(i.storageSize || 0)), seconds: Math.max(0, Math.round(i.length || 0)) })),
  );
  const values = sql`jsonb_to_recordset(${rows}::jsonb) as x(guid text, bytes bigint, seconds int)`;
  const [v, s, d] = await Promise.all([
    db.execute(sql`update videos t set storage_bytes = x.bytes,
                     duration_seconds = case when t.duration_seconds = 0 then x.seconds else t.duration_seconds end
                   from ${values}
                   where t.bunny_video_id = x.guid and (t.storage_bytes <> x.bytes or (t.duration_seconds = 0 and x.seconds > 0))`),
    db.execute(sql`update stories t set storage_bytes = x.bytes,
                     duration_seconds = case when t.duration_seconds = 0 then least(x.seconds, 600) else t.duration_seconds end
                   from ${values}
                   where t.bunny_video_id = x.guid and (t.storage_bytes <> x.bytes or (t.duration_seconds = 0 and x.seconds > 0))`),
    db.execute(sql`update video_drafts t set storage_bytes = x.bytes,
                     duration_seconds = case when t.duration_seconds = 0 then x.seconds else t.duration_seconds end
                   from ${values}
                   where t.bunny_video_id = x.guid and (t.storage_bytes <> x.bytes or (t.duration_seconds = 0 and x.seconds > 0))`),
  ]);
  return (v.rowCount ?? 0) + (s.rowCount ?? 0) + (d.rowCount ?? 0);
}

/** What the library holds and which of its videos no row knows (pure: tested without Bunny or a database). */
export function summariseLibrary(items: Pick<BunnyVideoResponse, "guid" | "storageSize" | "length" | "title" | "dateUploaded">[], known: Set<string>) {
  const orphans = items.filter((i) => !known.has(i.guid));
  return {
    libraryBytes: items.reduce((total, i) => total + Math.max(0, i.storageSize || 0), 0),
    librarySeconds: Math.round(items.reduce((total, i) => total + Math.max(0, i.length || 0), 0)),
    orphans,
    orphanBytes: orphans.reduce((total, i) => total + Math.max(0, i.storageSize || 0), 0),
  };
}

/** The Bunny GUIDs any row knows. */
async function knownGuids(): Promise<Set<string>> {
  const result = await db.execute<{ guid: string }>(sql`
    select bunny_video_id as guid from videos
    union select bunny_video_id from stories where bunny_video_id is not null
    union select bunny_video_id from video_drafts`);
  return new Set(result.rows.map((r) => r.guid));
}

export async function reconcileStorage(options: { client?: Lister; env?: Record<string, string | undefined>; fetchImpl?: typeof fetch } = {}): Promise<ReconcileResult> {
  const env = options.env ?? process.env;
  const config = bunnyStreamConfig();
  const client = options.client ?? new BunnyStreamClient(config);
  const items = await client.listAllVideos();
  const atBunny = new Set(items.map((i) => i.guid));

  const updatedRows = await applyBunnySizes(items);
  const missingVideos = await zeroRowsMissingFrom(atBunny);
  const { libraryBytes, librarySeconds, orphans, orphanBytes } = summariseLibrary(items, await knownGuids());

  let libraryTotals: ReconcileResult["libraryTotals"] = null;
  let zone: ReconcileResult["zone"] = null;
  const accountKey = env.MEDIA_ACCOUNT_API_KEY?.trim();
  if (accountKey) {
    const fetchImpl = options.fetchImpl ?? fetch;
    libraryTotals = await getLibraryTotals(config.libraryId, accountKey, fetchImpl).catch((error: unknown) => {
      console.warn("quota: library totals unavailable", error instanceof Error ? error.message : error);
      return null;
    });
    const zoneTotals = await getStorageZoneTotals({ id: env.MEDIA_STORAGE_ZONE_ID, name: env.MEDIA_STORAGE_ZONE }, accountKey, fetchImpl).catch((error: unknown) => {
      console.warn("quota: storage zone totals unavailable", error instanceof Error ? error.message : error);
      return null;
    });
    zone = zoneTotals ? { bytes: zoneTotals.storageBytes, files: zoneTotals.files } : null;
  }

  // The application's own count, before this run's orphans are added to it.
  const appBytes = (await platformUsage()).bytes - Number((await latestOrphanBytes()) ?? 0);

  const [snapshot] = await db
    .insert(storageSnapshots)
    .values({
      libraryBytes,
      libraryVideos: items.length,
      librarySeconds,
      zoneBytes: zone?.bytes ?? null,
      zoneFiles: zone?.files ?? null,
      appBytes,
      orphanBytes,
      orphanVideos: orphans.length,
      missingVideos,
      updatedRows,
      details: {
        orphans: orphans.slice(0, 50).map((o) => ({ guid: o.guid, title: o.title, bytes: o.storageSize, uploaded: o.dateUploaded })),
        libraryTotals,
      },
    })
    .returning({ id: storageSnapshots.id });

  // Files held for want of space may fit now that the figures are exact.
  const holders = await db.execute<{ creator_id: string }>(sql`
    select distinct creator_id from videos where status = 'HELD' union select distinct creator_id from stories where status = 'HELD'`);
  let released = 0;
  for (const { creator_id } of holders.rows) {
    const r = await releaseHeld(creator_id);
    released += r.videos.length + r.stories.length;
  }
  const alerts = await checkPlatformAlerts({ force: true });

  console.info(
    `quota: reconciled ${items.length} Bunny video(s), ${updatedRows} row(s) corrected, ${missingVideos} missing, ${orphans.length} orphan(s) (${orphanBytes} bytes)`,
  );
  return {
    snapshotId: snapshot.id,
    libraryVideos: items.length,
    libraryBytes,
    librarySeconds,
    appBytes,
    orphanVideos: orphans.length,
    orphanBytes,
    missingVideos,
    updatedRows,
    zone,
    libraryTotals: libraryTotals ? { storageBytes: libraryTotals.storageBytes, videoCount: libraryTotals.videoCount } : null,
    released,
    alerts,
  };
}

async function latestOrphanBytes() {
  const [row] = await db.select({ orphanBytes: storageSnapshots.orphanBytes }).from(storageSnapshots).orderBy(desc(storageSnapshots.takenAt)).limit(1);
  return row?.orphanBytes ?? 0;
}

/** Minutes between two automatic reconciliations (ABUSE_QUOTA_RECONCILE_INTERVAL_MINUTES, 360; 0 = never). */
export function reconcileIntervalMinutes(env: Record<string, string | undefined> = process.env): number {
  const raw = Number(env.ABUSE_QUOTA_RECONCILE_INTERVAL_MINUTES?.trim() || 360);
  return Number.isFinite(raw) && raw >= 0 ? Math.min(raw, 7 * 24 * 60) : 360;
}

/** True when the last reconciliation is older than the interval (so instances do not all run it). */
export async function reconcileIsDue(now = new Date(), env: Record<string, string | undefined> = process.env): Promise<boolean> {
  const minutes = reconcileIntervalMinutes(env);
  if (minutes === 0 || !env.MEDIA_STREAM_API_KEY?.trim()) return false;
  const [last] = await db.select({ takenAt: storageSnapshots.takenAt }).from(storageSnapshots).orderBy(desc(storageSnapshots.takenAt)).limit(1);
  return !last || differenceInMilliseconds(now, last.takenAt) >= minutes * 60_000;
}

