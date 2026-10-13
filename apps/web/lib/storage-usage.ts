import { db, profiles, storageAlerts, storageSnapshots, stories, users, videoDrafts, videos } from "@orochia/db";
import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";

import { HttpError } from "./http";
import {
  type Allowance,
  evaluateUpload,
  holdAfterEncoding,
  percentUsed,
  planFor,
  type QuotaConfig,
  quotaConfig,
  type QuotaKind,
  reachedThresholds,
  type Usage,
  usageLevel,
} from "./quotas";
import { checkRateLimit } from "./rate-limit";

/**
 * Storage quotas, applied (rules: lib/quotas.ts). The **source of truth is the database**: every file Orochia keeps at
 * Bunny is a row that carries its bytes (`videos`, `stories`, `video_drafts` → `storage_bytes`) and its length
 * (`duration_seconds`):
 *
 * 1. an upload session records the DECLARED size before the Tus signature is issued — refused first if it does not fit;
 * 2. the encoding webhook (or the stories' catch-up) replaces it with Bunny's `storageSize` (renditions included) and
 *    the real length — and HOLDS the file (status HELD: kept, private) when it no longer fits;
 * 3. deleting a draft removes its row; a video or story a creator withdraws stops counting for them (its file stays at
 *    Bunny for the record and still counts for the platform);
 * 4. `npm run quota:reconcile` (and the background loop, and the admin API) lists the library at Bunny and corrects
 *    every row, recording the drift and the files no row knows (`storage_snapshots.orphan_bytes`, added to the
 *    platform's usage). Bunny is never asked at upload time.
 */

export class QuotaError extends HttpError {
  constructor(status: number, message: string, code: string, details: Record<string, unknown>, retryAfterSeconds?: number) {
    super(status, message, { code, quota: details }, retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : {});
    this.name = "QuotaError";
  }
}

const sum = (column: unknown) => sql<string>`coalesce(sum(${column}), 0)`;
const toUsage = (row: { bytes: string | number; seconds: string | number } | undefined): Usage => ({
  bytes: Number(row?.bytes ?? 0),
  seconds: Number(row?.seconds ?? 0),
});
const add = (...parts: Usage[]): Usage => parts.reduce((a, b) => ({ bytes: a.bytes + b.bytes, seconds: a.seconds + b.seconds }), { bytes: 0, seconds: 0 });

/**
 * What counts against a creator: their live videos (not withdrawn, not failed), their stories still showing or being
 * encoded, and their drafts. Held files count — they occupy the space.
 */
export async function creatorUsage(userId: string): Promise<Usage> {
  const [v, s, d] = await Promise.all([
    db
      .select({ bytes: sum(videos.storageBytes), seconds: sum(videos.durationSeconds) })
      .from(videos)
      .where(and(eq(videos.creatorId, userId), sql`${videos.removedAt} is null`, sql`${videos.status} <> 'FAILED'`)),
    db
      .select({ bytes: sum(stories.storageBytes), seconds: sum(stories.durationSeconds) })
      .from(stories)
      .where(and(eq(stories.creatorId, userId), sql`${stories.removedAt} is null`, sql`${stories.status} <> 'FAILED'`, sql`${stories.expiresAt} > now()`)),
    db.select({ bytes: sum(videoDrafts.storageBytes), seconds: sum(videoDrafts.durationSeconds) }).from(videoDrafts).where(eq(videoDrafts.ownerId, userId)),
  ]);
  return add(toUsage(v[0]), toUsage(s[0]), toUsage(d[0]));
}

/** The latest reconciliation with Bunny (null before the first one). */
export async function latestSnapshot() {
  const [row] = await db.select().from(storageSnapshots).orderBy(desc(storageSnapshots.takenAt)).limit(1);
  return row ?? null;
}

/**
 * What the platform holds at Bunny: every row whose file is kept (withdrawn and expired included, failed excluded),
 * plus the files the last reconciliation found at Bunny that no row knows.
 */
export async function platformUsage(): Promise<Usage & { orphanBytes: number }> {
  const [v, s, d, snapshot] = await Promise.all([
    db.select({ bytes: sum(videos.storageBytes), seconds: sum(videos.durationSeconds) }).from(videos).where(sql`${videos.status} <> 'FAILED'`),
    db.select({ bytes: sum(stories.storageBytes), seconds: sum(stories.durationSeconds) }).from(stories).where(sql`${stories.status} <> 'FAILED'`),
    db.select({ bytes: sum(videoDrafts.storageBytes), seconds: sum(videoDrafts.durationSeconds) }).from(videoDrafts),
    latestSnapshot(),
  ]);
  const orphanBytes = Number(snapshot?.orphanBytes ?? 0);
  const usage = add(toUsage(v[0]), toUsage(s[0]), toUsage(d[0]));
  return { bytes: usage.bytes + orphanBytes, seconds: usage.seconds, orphanBytes };
}

/** Upload sessions of an account: opened in the last 24 hours (and the oldest), and still waiting for their bytes. */
export async function uploadCounts(userId: string): Promise<{ today: { count: number; oldestAt: Date | null }; concurrent: number }> {
  const result = await db.execute<{ today: string; oldest: Date | string | null; pending: string }>(sql`
    with sessions as (
      select created_at, status::text as status from videos where creator_id = ${userId} and created_at > now() - interval '24 hours'
      union all
      select created_at, status::text from stories where creator_id = ${userId} and media_type = 'VIDEO' and created_at > now() - interval '24 hours'
      union all
      select created_at, status::text from video_drafts where owner_id = ${userId} and created_at > now() - interval '24 hours'
    )
    select count(*) as today, min(created_at) as oldest,
           count(*) filter (where status = 'PENDING_UPLOAD' and created_at > now() - interval '2 hours') as pending
    from sessions`);
  const row = result.rows[0];
  return {
    today: { count: Number(row?.today ?? 0), oldestAt: row?.oldest ? new Date(row.oldest) : null },
    concurrent: Number(row?.pending ?? 0),
  };
}

async function accountPlan(userId: string, config: QuotaConfig) {
  const [account] = await db.select({ role: users.role, storagePlan: users.storagePlan }).from(users).where(eq(users.id, userId)).limit(1);
  return planFor(account ?? { role: "MEMBER" }, config);
}

const details = (plan: { name: string; allowance: Allowance }, usage: Usage) => ({
  plan: plan.name,
  usedBytes: usage.bytes,
  limitBytes: plan.allowance.bytes,
  usedSeconds: usage.seconds,
  limitSeconds: plan.allowance.seconds,
});

/**
 * Before an upload session is opened (and its Tus signature issued): refuses, with a stable code, a file that does not
 * fit — 413 for size and time, 429 (with Retry-After) for the daily and concurrent counts. A configuration error is a
 * 503 (fail closed). Disabled quotas let everything through.
 */
export async function assertUploadAllowed(userId: string, request: { kind: QuotaKind; sizeBytes: number; durationSeconds?: number | null }) {
  const config = quotaConfig();
  if (!config.enabled) return;
  const [plan, usage, platform, counts] = await Promise.all([accountPlan(userId, config), creatorUsage(userId), platformUsage(), uploadCounts(userId)]);
  const decision = evaluateUpload(request, { config, creator: { usage, allowance: plan.allowance }, platform: { usage: platform }, ...counts });
  if (decision.ok) return;
  if (decision.code.startsWith("PLATFORM_")) console.warn(`quota: upload refused, ${decision.code} (${platform.bytes} bytes, ${platform.seconds} s)`);
  throw new QuotaError(decision.status, decision.message, decision.code, details(plan, usage), decision.retryAfterSeconds);
}

type Holder = { table: "videos" | "stories" | "drafts"; id: string; creatorId: string };

/** The row a Bunny video belongs to (a video, a story or a draft original). */
async function findHolder(bunnyVideoId: string): Promise<Holder | null> {
  const [v] = await db.select({ id: videos.id, creatorId: videos.creatorId }).from(videos).where(eq(videos.bunnyVideoId, bunnyVideoId)).limit(1);
  if (v) return { table: "videos", ...v };
  const [s] = await db.select({ id: stories.id, creatorId: stories.creatorId }).from(stories).where(eq(stories.bunnyVideoId, bunnyVideoId)).limit(1);
  if (s) return { table: "stories", ...s };
  const [d] = await db.select({ id: videoDrafts.id, creatorId: videoDrafts.ownerId }).from(videoDrafts).where(eq(videoDrafts.bunnyVideoId, bunnyVideoId)).limit(1);
  return d ? { table: "drafts", ...d } : null;
}

/** Records the bytes Bunny reports for a file (its `storageSize`); returns the row it belongs to. */
export async function recordStoredBytes(bunnyVideoId: string, storageBytes: number): Promise<Holder | null> {
  const holder = await findHolder(bunnyVideoId);
  if (!holder || !Number.isFinite(storageBytes) || storageBytes < 0) return holder;
  const bytes = Math.round(storageBytes);
  if (holder.table === "videos") await db.update(videos).set({ storageBytes: bytes }).where(eq(videos.id, holder.id));
  else if (holder.table === "stories") await db.update(stories).set({ storageBytes: bytes }).where(eq(stories.id, holder.id));
  else await db.update(videoDrafts).set({ storageBytes: bytes }).where(eq(videoDrafts.id, holder.id));
  return holder;
}

/**
 * After encoding, with the real size recorded: should this creator's new file be held? "CREATOR" (their plan is
 * exceeded), "PLATFORM" (the platform's cap is) or null (it goes online). Never deletes anything.
 */
export async function holdReason(creatorId: string): Promise<"CREATOR" | "PLATFORM" | null> {
  let config: QuotaConfig;
  try {
    config = quotaConfig();
  } catch (error) {
    console.error("quota: configuration invalid — encoded file not held", error);
    return null;
  }
  if (!config.enabled) return null;
  const [plan, usage, platform] = await Promise.all([accountPlan(creatorId, config), creatorUsage(creatorId), platformUsage()]);
  return holdAfterEncoding({ config, creator: { usage, allowance: plan.allowance }, platform: { usage: platform } });
}

/**
 * Puts a creator's held videos and stories back online when everything they keep fits again (after a deletion, a
 * larger plan, a reconciliation). Returns the ids released (videos then stories).
 */
export async function releaseHeld(creatorId: string): Promise<{ videos: string[]; stories: string[] }> {
  if ((await holdReason(creatorId)) !== null) return { videos: [], stories: [] };
  const releasedVideos = await db
    .update(videos)
    .set({ status: "READY", updatedAt: new Date() })
    .where(and(eq(videos.creatorId, creatorId), eq(videos.status, "HELD")))
    .returning({ id: videos.id });
  const releasedStories = await db
    .update(stories)
    .set({ status: "READY", expiresAt: new Date(Date.now() + 24 * 3600 * 1000), updatedAt: new Date() })
    .where(and(eq(stories.creatorId, creatorId), eq(stories.status, "HELD")))
    .returning({ id: stories.id });
  if (releasedVideos.length + releasedStories.length > 0) {
    console.info(`quota: released ${releasedVideos.length} video(s) and ${releasedStories.length} story(ies) of ${creatorId}`);
  }
  return { videos: releasedVideos.map((r) => r.id), stories: releasedStories.map((r) => r.id) };
}

export interface StorageOverview {
  enabled: boolean;
  plan: string;
  used: Usage;
  limit: Allowance;
  percent: number | null;
  percentSeconds: number | null;
  level: ReturnType<typeof usageLevel>;
  held: number;
  /** Uploads are paused for everyone (the platform is full). */
  platformPaused: boolean;
  perFile: QuotaConfig["perFile"];
  uploadsPerDay: number | null;
  uploadsToday: number;
}

/** A creator's storage, for their dashboard gauge (GET /api/me/storage). */
export async function storageOverview(userId: string): Promise<StorageOverview> {
  const config = quotaConfig();
  const [plan, used, platform, counts, held] = await Promise.all([
    accountPlan(userId, config),
    creatorUsage(userId),
    platformUsage(),
    uploadCounts(userId),
    db.execute<{ n: string }>(sql`
      select (select count(*) from videos where creator_id = ${userId} and status = 'HELD' and removed_at is null)
           + (select count(*) from stories where creator_id = ${userId} and status = 'HELD' and removed_at is null) as n`),
  ]);
  const limit = config.enabled ? plan.allowance : { bytes: null, seconds: null };
  const platformPaused =
    config.enabled &&
    ((config.platform.bytes !== null && platform.bytes >= config.platform.bytes) || (config.platform.seconds !== null && platform.seconds >= config.platform.seconds));
  return {
    enabled: config.enabled,
    plan: plan.name,
    used,
    limit,
    percent: percentUsed(used.bytes, limit.bytes),
    percentSeconds: percentUsed(used.seconds, limit.seconds),
    level: usageLevel(used.bytes, limit.bytes),
    held: Number(held.rows[0]?.n ?? 0),
    platformPaused,
    perFile: config.perFile,
    uploadsPerDay: config.enabled ? config.uploadsPerDay : null,
    uploadsToday: counts.today.count,
  };
}

/** The operators' view (GET /api/admin/storage): the platform against its cap, the largest accounts, the last reconciliation. */
export async function adminStorageOverview(options: { top?: number } = {}) {
  const config = quotaConfig();
  const [platform, snapshot, top] = await Promise.all([
    platformUsage(),
    latestSnapshot(),
    db.execute<{ id: string; username: string; display_name: string | null; role: string; storage_plan: string | null; bytes: string; seconds: string; held: string }>(sql`
      with usage as (
        select creator_id as id, storage_bytes as bytes, duration_seconds as seconds, (status = 'HELD')::int as held
          from videos where removed_at is null and status <> 'FAILED'
        union all
        select creator_id, storage_bytes, duration_seconds, (status = 'HELD')::int
          from stories where removed_at is null and status <> 'FAILED' and expires_at > now()
        union all
        select owner_id, storage_bytes, duration_seconds, 0 from video_drafts
      )
      select u.id, u.username, p.display_name, u.role::text as role, u.storage_plan,
             sum(usage.bytes) as bytes, sum(usage.seconds) as seconds, sum(usage.held) as held
      from usage join users u on u.id = usage.id left join ${profiles} p on p.user_id = u.id
      group by u.id, u.username, p.display_name, u.role, u.storage_plan
      order by sum(usage.bytes) desc
      limit ${Math.min(Math.max(options.top ?? 20, 1), 100)}`),
  ]);
  return {
    enabled: config.enabled,
    platform: {
      used: { bytes: platform.bytes, seconds: platform.seconds },
      orphanBytes: platform.orphanBytes,
      limit: config.platform,
      percent: percentUsed(platform.bytes, config.platform.bytes),
      percentSeconds: percentUsed(platform.seconds, config.platform.seconds),
      level: usageLevel(platform.bytes, config.platform.bytes),
      alertThresholds: config.alertThresholds,
    },
    plans: config.plans,
    adminPlan: config.adminPlan,
    perFile: config.perFile,
    uploadsPerDay: config.uploadsPerDay,
    concurrentUploads: config.concurrentUploads,
    imageUploadsPerDay: config.imageUploadsPerDay,
    topCreators: top.rows.map((r) => {
      const plan = planFor({ role: r.role, storagePlan: r.storage_plan }, config);
      const bytes = Number(r.bytes);
      return {
        id: r.id,
        username: r.username,
        displayName: r.display_name,
        role: r.role,
        plan: plan.name,
        usedBytes: bytes,
        usedSeconds: Number(r.seconds),
        limitBytes: plan.allowance.bytes,
        percent: percentUsed(bytes, plan.allowance.bytes),
        held: Number(r.held),
      };
    }),
    lastReconciliation: snapshot,
  };
}

/** Sets (or clears, with null) an account's storage plan — operators only; the plan must exist in ABUSE_QUOTA_PLANS. */
export async function setStoragePlan(userId: string, plan: string | null) {
  const config = quotaConfig();
  const name = plan?.trim().toLowerCase() || null;
  if (name && !config.plans[name]) throw new HttpError(400, `Unknown plan "${name}". Plans: ${Object.keys(config.plans).join(", ")}`, { code: "UNKNOWN_PLAN" });
  const [row] = await db.update(users).set({ storagePlan: name, updatedAt: new Date() }).where(eq(users.id, userId)).returning({ id: users.id, role: users.role });
  if (!row) throw new HttpError(404, "Account not found");
  const released = await releaseHeld(userId);
  return { plan: planFor({ role: row.role, storagePlan: name }, config).name, released };
}

/**
 * Tells the operators once each time the platform crosses an alert threshold (80 %, 95 % by default) — an in-app and
 * e-mail notification to every ADMIN account, and a warning in the log — and re-arms a threshold once usage falls
 * 2 points under it. Checked at most once a minute per instance; the `storage_alerts` row makes it once overall.
 */
export async function checkPlatformAlerts(options: { force?: boolean } = {}): Promise<number[]> {
  try {
    if (!options.force && !(await checkRateLimit("storage-alerts:check", 1, 60)).success) return [];
    const config = quotaConfig();
    if (!config.enabled || config.platform.bytes === null) return [];
    const usage = await platformUsage();
    const limit = config.platform.bytes;
    const reached = reachedThresholds(usage.bytes, limit, config.alertThresholds);
    const rearm = config.alertThresholds.filter((t) => (percentUsed(usage.bytes, limit) ?? 0) < t - 2);
    if (rearm.length) await db.delete(storageAlerts).where(inArray(storageAlerts.threshold, rearm));
    const fresh: number[] = [];
    for (const threshold of reached) {
      const [row] = await db
        .insert(storageAlerts)
        .values({ threshold, usedBytes: usage.bytes, limitBytes: limit })
        .onConflictDoNothing()
        .returning({ threshold: storageAlerts.threshold });
      if (row) fresh.push(threshold);
    }
    if (fresh.length) {
      const top = Math.max(...fresh);
      const percent = percentUsed(usage.bytes, limit);
      console.warn(`quota: platform storage at ${percent} % of ${limit} bytes (threshold ${top} %)`);
      const { notify } = await import("./notifications");
      const admins = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "ADMIN"), sql`${users.suspendedAt} is null`));
      const vars = { percent: String(percent), used: formatBytes(usage.bytes), limit: formatBytes(limit) };
      await Promise.all(admins.map((a) => notify({ userId: a.id, event: "storageAlert", vars, path: "/dashboard" })));
    }
    return fresh;
  } catch (error) {
    console.error("quota: platform alert check failed", error);
    return [];
  }
}

/** A creator just passed 90 % of their plan: told at most once a week (bell + e-mail). */
export async function warnCreatorIfLow(creatorId: string) {
  try {
    const config = quotaConfig();
    if (!config.enabled) return;
    const [plan, usage] = await Promise.all([accountPlan(creatorId, config), creatorUsage(creatorId)]);
    const percent = percentUsed(usage.bytes, plan.allowance.bytes);
    if (percent === null || percent < 90) return;
    if (!(await checkRateLimit(`storage-low:${creatorId}`, 1, 7 * 86_400)).success) return;
    const { notify } = await import("./notifications");
    await notify({ userId: creatorId, event: "storageLow", vars: { percent: String(Math.min(100, Math.round(percent))), limit: formatBytes(plan.allowance.bytes ?? 0) }, path: "/dashboard?tab=uploads" });
  } catch (error) {
    console.error("quota: creator warning failed", error);
  }
}

/** 1.4 GB, 820 MB (binary units, the way the limits are configured). */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 4) return `${(bytes / 1024 ** 4).toFixed(1)} TB`;
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/** Rows of the three tables whose Bunny video is in `guids` — the reconciliation's input. */
export async function rowsForGuids(guids: string[]) {
  if (guids.length === 0) return [];
  const [v, s, d] = await Promise.all([
    db.select({ guid: videos.bunnyVideoId, bytes: videos.storageBytes, seconds: videos.durationSeconds }).from(videos).where(inArray(videos.bunnyVideoId, guids)),
    db.select({ guid: stories.bunnyVideoId, bytes: stories.storageBytes, seconds: stories.durationSeconds }).from(stories).where(inArray(stories.bunnyVideoId, guids)),
    db.select({ guid: videoDrafts.bunnyVideoId, bytes: videoDrafts.storageBytes, seconds: videoDrafts.durationSeconds }).from(videoDrafts).where(inArray(videoDrafts.bunnyVideoId, guids)),
  ]);
  return [...v, ...s, ...d];
}

/** Rows that claim bytes for a Bunny video that is not in `guids` (deleted at Bunny): set to 0. */
export async function zeroRowsMissingFrom(guids: Set<string>): Promise<number> {
  const keep = [...guids];
  const notIn = <T extends typeof videos.bunnyVideoId | typeof stories.bunnyVideoId | typeof videoDrafts.bunnyVideoId>(column: T) =>
    keep.length ? notInArray(column, keep) : sql`true`;
  const [v, s, d] = await Promise.all([
    db.update(videos).set({ storageBytes: 0 }).where(and(sql`${videos.storageBytes} > 0`, notIn(videos.bunnyVideoId))).returning({ id: videos.id }),
    db.update(stories).set({ storageBytes: 0 }).where(and(sql`${stories.storageBytes} > 0`, sql`${stories.bunnyVideoId} is not null`, notIn(stories.bunnyVideoId))).returning({ id: stories.id }),
    db.update(videoDrafts).set({ storageBytes: 0 }).where(and(sql`${videoDrafts.storageBytes} > 0`, notIn(videoDrafts.bunnyVideoId))).returning({ id: videoDrafts.id }),
  ]);
  return v.length + s.length + d.length;
}
