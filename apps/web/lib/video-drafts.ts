import { BunnyStreamClient, UPLOAD_LIMITS, DRAFT_MUSIC_MAX_BYTES, signBunnyFileUrl } from "@orochia/media";
import { db, users, videoDrafts } from "@orochia/db";
import { and, count, desc, eq, lte, ne } from "drizzle-orm";
import { bunnyStreamConfig, draftsConfig, requireBunnyStream } from "./env";
import { HttpError } from "./http";
import { deletePrivateFile, uploadMediaFile } from "./storage";
import { parseStoredEdit, type StoredEdit } from "./video-edit-settings";

/**
 * Editor drafts (AGENTS.md §3.A): the original clip goes straight to Bunny over Tus (drafts collection),
 * the settings and the form live in `video_drafts`, the music privately in storage. Only the owner sees,
 * resumes or deletes a draft; it expires after DRAFT_RETENTION_DAYS and is removed with its files.
 */

export const DRAFT_KINDS = ["VIDEO", "STORY"] as const;
export type DraftKindDb = (typeof DRAFT_KINDS)[number];

/** What the form held (free text is capped; nothing here grants anything — it only refills the form). */
export type DraftDetails = Record<string, string | number | boolean | string[] | null>;

export function parseDetails(value: unknown): DraftDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: DraftDetails = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>).slice(0, 20)) {
    if (!/^[a-zA-Z]{1,40}$/.test(key)) continue;
    if (typeof v === "string") out[key] = v.slice(0, 5000);
    else if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
    else if (typeof v === "boolean" || v === null) out[key] = v;
    else if (Array.isArray(v)) out[key] = v.filter((x): x is string => typeof x === "string").slice(0, 30).map((x) => x.slice(0, 60));
  }
  return out;
}

async function requireCreator(userId: string) {
  const [account] = await db.select({ role: users.role, isVerified: users.isVerified, username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
  if (!account || (account.role !== "CREATOR" && account.role !== "ADMIN")) throw new HttpError(403, "Only creators keep drafts");
  if (!account.isVerified) throw new HttpError(403, "Creator verification (18 U.S.C. § 2257 records) is pending");
  return account;
}

async function removeFiles(draft: Pick<typeof videoDrafts.$inferSelect, "bunnyVideoId" | "musicRef">) {
  await new BunnyStreamClient(bunnyStreamConfig()).deleteVideo(draft.bunnyVideoId).catch((error) => console.error("drafts: Bunny delete failed", error));
  if (draft.musicRef) await deletePrivateFile(draft.musicRef).catch((error) => console.error("drafts: music delete failed", error));
}

/** Expired drafts of this owner go, with their files (lazily: on each listing). */
async function purgeExpired(ownerId: string) {
  const expired = await db
    .delete(videoDrafts)
    .where(and(eq(videoDrafts.ownerId, ownerId), lte(videoDrafts.expiresAt, new Date())))
    .returning({ bunnyVideoId: videoDrafts.bunnyVideoId, musicRef: videoDrafts.musicRef });
  await Promise.all(expired.map(removeFiles));
}

const expiry = () => new Date(Date.now() + draftsConfig().retentionDays * 86_400_000);

function present(row: typeof videoDrafts.$inferSelect) {
  const config = bunnyStreamConfig();
  const sign = (file: string, windowSeconds: number) => signBunnyFileUrl({ hostname: config.hostname, path: `/${row.bunnyVideoId}/${file}`, tokenAuthKey: config.tokenAuthKey, windowSeconds });
  return {
    id: row.id,
    kind: row.kind as DraftKindDb,
    status: row.status,
    fileName: row.fileName,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    edit: row.edit as StoredEdit,
    details: row.details as DraftDetails,
    musicName: row.musicName,
    hasMusic: Boolean(row.musicRef),
    thumbnailUrl: row.status === "READY" ? sign("thumbnail.jpg", 6 * 3600) : null,
    /** The original clip, for the editor to open again (short-lived). */
    originalUrl: row.status === "PENDING_UPLOAD" || row.status === "FAILED" ? null : sign("original", 3600),
    expiresAt: row.expiresAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
export type DraftView = ReturnType<typeof present>;

export async function listDrafts(ownerId: string, kind?: DraftKindDb): Promise<DraftView[]> {
  await purgeExpired(ownerId);
  const rows = await db
    .select()
    .from(videoDrafts)
    .where(kind ? and(eq(videoDrafts.ownerId, ownerId), eq(videoDrafts.kind, kind)) : eq(videoDrafts.ownerId, ownerId))
    .orderBy(desc(videoDrafts.updatedAt));
  return rows.map(present);
}

async function owned(ownerId: string, draftId: string) {
  const [row] = await db.select().from(videoDrafts).where(and(eq(videoDrafts.id, draftId), eq(videoDrafts.ownerId, ownerId))).limit(1);
  if (!row || row.expiresAt <= new Date()) throw new HttpError(404, "Draft not found");
  return row;
}

export async function getDraft(ownerId: string, draftId: string): Promise<DraftView> {
  return present(await owned(ownerId, draftId));
}

export interface NewDraft {
  kind: DraftKindDb;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  edit: unknown;
  details?: unknown;
}

/** Records a draft and returns a Tus session to send its original clip straight to Bunny. */
export async function createDraft(ownerId: string, input: NewDraft) {
  const account = await requireCreator(ownerId);
  const edit = parseStoredEdit(input.edit);
  if (!edit) throw new HttpError(400, "Invalid edit settings");
  if (input.sizeBytes > UPLOAD_LIMITS.draft.maxBytes) throw new HttpError(413, "This clip is too large to keep as a draft");
  await purgeExpired(ownerId);
  const [{ n }] = await db.select({ n: count() }).from(videoDrafts).where(eq(videoDrafts.ownerId, ownerId));
  if (n >= draftsConfig().maxPerUser) throw new HttpError(409, "You have too many drafts. Publish or delete one first.");

  const config = requireBunnyStream();
  const client = new BunnyStreamClient(config);
  const session = await client.createTusUploadSession(`draft · @${account.username}`, 7200, config.draftsCollectionId ?? config.collectionId);
  try {
    const [row] = await db
      .insert(videoDrafts)
      .values({
        ownerId,
        kind: input.kind,
        bunnyVideoId: session.videoGuid,
        fileName: input.fileName.slice(0, 255),
        contentType: input.contentType.slice(0, 100),
        sizeBytes: input.sizeBytes,
        edit,
        details: parseDetails(input.details),
        expiresAt: expiry(),
      })
      .returning();
    return { draft: present(row), session };
  } catch (error) {
    await client.deleteVideo(session.videoGuid).catch(() => undefined);
    throw error;
  }
}

/** New settings or form for a draft (the clip stays): saving again never re-sends the video. Extends its life. */
export async function updateDraft(ownerId: string, draftId: string, input: { edit?: unknown; details?: unknown }) {
  await owned(ownerId, draftId);
  const set: Partial<typeof videoDrafts.$inferInsert> = { updatedAt: new Date(), expiresAt: expiry() };
  if (input.edit !== undefined) {
    const edit = parseStoredEdit(input.edit);
    if (!edit) throw new HttpError(400, "Invalid edit settings");
    set.edit = edit;
  }
  if (input.details !== undefined) set.details = parseDetails(input.details);
  const [row] = await db.update(videoDrafts).set(set).where(eq(videoDrafts.id, draftId)).returning();
  return present(row);
}

const MUSIC_TYPES: Record<string, string> = { "audio/mpeg": ".mp3", "audio/mp3": ".mp3", "audio/mp4": ".m4a", "audio/x-m4a": ".m4a", "audio/aac": ".aac", "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/ogg": ".ogg" };

/** Keeps (or replaces) the draft's music track, privately; null removes it. */
export async function setDraftMusic(ownerId: string, draftId: string, music: File | null) {
  const draft = await owned(ownerId, draftId);
  let musicRef: string | null = null;
  let musicName: string | null = null;
  if (music) {
    const ext = MUSIC_TYPES[music.type];
    if (!ext) throw new HttpError(415, "Unsupported audio type (MP3, M4A, AAC, WAV, OGG)");
    if (music.size === 0 || music.size > DRAFT_MUSIC_MAX_BYTES) throw new HttpError(413, "Music file too large");
    const stored = await uploadMediaFile(Buffer.from(await music.arrayBuffer()), `music${ext}`, "audio");
    musicRef = stored.ref;
    musicName = music.name.slice(0, 255);
  }
  await db.update(videoDrafts).set({ musicRef, musicName, updatedAt: new Date() }).where(eq(videoDrafts.id, draftId));
  if (draft.musicRef && draft.musicRef !== musicRef) await deletePrivateFile(draft.musicRef).catch(() => undefined);
  return { musicName };
}

export async function draftMusicRef(ownerId: string, draftId: string) {
  const draft = await owned(ownerId, draftId);
  if (!draft.musicRef) throw new HttpError(404, "No music in this draft");
  return { ref: draft.musicRef, name: draft.musicName ?? "music" };
}

/** Deletes a draft and its files (also once it is published). */
export async function deleteDraft(ownerId: string, draftId: string) {
  const [row] = await db.delete(videoDrafts).where(and(eq(videoDrafts.id, draftId), eq(videoDrafts.ownerId, ownerId))).returning();
  if (!row) throw new HttpError(404, "Draft not found");
  await removeFiles(row);
}

/** Webhook: a draft's original is processed (READY lets the list show its thumbnail). Null when not a draft. */
export async function applyDraftEncoding(bunnyVideoId: string, target: "PROCESSING" | "READY" | "FAILED", durationSeconds?: number) {
  const [row] = await db
    .update(videoDrafts)
    .set({ status: target, ...(durationSeconds !== undefined ? { durationSeconds: Math.round(durationSeconds) } : {}) })
    // Events can arrive late: a READY draft never goes back to PROCESSING.
    .where(and(eq(videoDrafts.bunnyVideoId, bunnyVideoId), target === "PROCESSING" ? ne(videoDrafts.status, "READY") : undefined))
    .returning({ id: videoDrafts.id });
  if (row) return row.id;
  const [exists] = await db.select({ id: videoDrafts.id }).from(videoDrafts).where(eq(videoDrafts.bunnyVideoId, bunnyVideoId)).limit(1);
  return exists?.id ?? null;
}

/** After the browser finished sending the original (Tus success): the clip can be opened again. */
export async function markDraftUploaded(ownerId: string, draftId: string) {
  const draft = await owned(ownerId, draftId);
  if (draft.status === "PENDING_UPLOAD") await db.update(videoDrafts).set({ status: "PROCESSING" }).where(eq(videoDrafts.id, draftId));
}
