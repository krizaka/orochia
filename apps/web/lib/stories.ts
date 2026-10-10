import { db, stories, storyViews, storyLikes, users, profiles, audienceLists, audienceListMembers } from "@orochia/db";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { BunnyApiError, BunnyStreamClient, exceedsLength, generateBunnyStreamToken, mapBunnyApiStatusToOrochia, signBunnyFileUrl } from "@orochia/media";
import { areContacts, isApprovedFollower, paidForChallengeStory } from "./access";
import { bunnyStreamConfig, requireBunnyStream } from "./env";
import { viewerKey } from "./engagement";
import { HttpError } from "./http";
import { signMediaUrl } from "./media-urls";
import { publicUrlForRef } from "./storage";

/**
 * Stories: images or short videos that live 24 hours (Instagram-style). Video stories are Bunny
 * Stream videos filed in the stories collection, uploaded straight from the browser over Tus and
 * made playable by the Bunny webhook — their 24 hours start then. Who sees a story uses the video
 * rules (public, approved followers, contacts, or one of the creator's audience lists); everything
 * a viewer receives is signed for them only after that check.
 */

export const STORY_LIFETIME_MS = 24 * 3600 * 1000;
export const STORY_AUDIENCES = ["PUBLIC", "APPROVED_FOLLOWERS_ONLY", "CONTACTS_ONLY", "INVITED_ONLY"] as const;
export type StoryAudience = (typeof STORY_AUDIENCES)[number];
/** Signed story playlists stay valid long enough to watch a story, not to share it. */
const PLAY_TTL_SECONDS = 15 * 60;

type StoryRow = typeof stories.$inferSelect;

/** Whether a viewer may see a story (the creator always sees their own). */
export async function canViewStory(story: Pick<StoryRow, "id" | "creatorId" | "visibility" | "audienceListId">, viewerId: string | null): Promise<boolean> {
  if (viewerId && viewerId === story.creatorId) return true;
  if (story.visibility === "PUBLIC") return true;
  if (!viewerId) return false;
  if (story.visibility === "APPROVED_FOLLOWERS_ONLY") return isApprovedFollower(viewerId, story.creatorId);
  if (story.visibility === "CONTACTS_ONLY") return areContacts(viewerId, story.creatorId);
  if (story.visibility === "INVITED_ONLY" && story.audienceListId) {
    const [member] = await db
      .select({ id: audienceListMembers.id })
      .from(audienceListMembers)
      .where(and(eq(audienceListMembers.listId, story.audienceListId), eq(audienceListMembers.userId, viewerId)))
      .limit(1);
    return Boolean(member);
  }
  // Delivered for a challenge: the people whose pledges paid for it.
  if (story.visibility === "CHALLENGE") return paidForChallengeStory(story.id, viewerId);
  return false;
}

/**
 * Where a story stands for whoever sees it. Others only ever receive "ready" stories; the author also
 * sees their own video stories while Bunny encodes them ("processing") or when encoding failed.
 */
export type StoryState = "ready" | "processing" | "failed";

export function storyState(status: StoryRow["status"]): StoryState {
  if (status === "READY") return "ready";
  if (status === "FAILED") return "failed";
  return "processing";
}

export interface StoryItem {
  id: string;
  type: "image" | "video";
  state: StoryState;
  /** Image URL, or the signed HLS playlist of a video story. */
  url: string;
  thumbnailUrl: string | null;
  caption: string;
  durationSeconds: number;
  createdAt: Date;
  expiresAt: Date;
  viewsCount: number;
  likesCount: number;
  seen: boolean;
  liked: boolean;
}

export interface StoryRing {
  creatorId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isOwn: boolean;
  /** Every story of the ring was already seen by this viewer. */
  allSeen: boolean;
  stories: StoryItem[];
}

function playable(story: StoryRow): { url: string; thumbnailUrl: string | null } {
  if (story.mediaType === "VIDEO" && story.bunnyVideoId) {
    const config = bunnyStreamConfig();
    const signed = generateBunnyStreamToken({
      hostname: config.hostname,
      videoGuid: story.bunnyVideoId,
      tokenAuthKey: config.tokenAuthKey,
      expiresInSeconds: PLAY_TTL_SECONDS,
    });
    const thumbnail = signBunnyFileUrl({ hostname: config.hostname, path: `/${story.bunnyVideoId}/thumbnail.jpg`, tokenAuthKey: config.tokenAuthKey });
    return { url: signed.directM3u8Url, thumbnailUrl: thumbnail };
  }
  const url = signMediaUrl(story.mediaUrl) ?? "";
  return { url, thumbnailUrl: signMediaUrl(story.thumbnailUrl) ?? url };
}

/**
 * The stories rail for a viewer: one ring per creator with live stories the viewer may see — own
 * ring first, then unseen rings, then seen ones; inside a ring, oldest first (the order to watch).
 * With `includeOwnPending`, the viewer's own video stories are there from the upload on, marked
 * "processing" until Bunny has encoded them (or "failed"): an author always finds what they just shared.
 * Opt-in, because a client that predates `state` would try to play them (the mobile app, for now).
 */
export async function storyRail(viewerId: string | null, options: { includeOwnPending?: boolean } = {}): Promise<StoryRing[]> {
  const shown = viewerId && options.includeOwnPending
    ? or(eq(stories.status, "READY"), and(eq(stories.creatorId, viewerId), eq(stories.mediaType, "VIDEO")))
    : eq(stories.status, "READY");
  const rows = await db
    .select({
      story: stories,
      username: users.username,
      displayName: sql<string>`coalesce(${profiles.displayName}, ${users.username})`,
      avatarUrl: profiles.avatarUrl,
    })
    .from(stories)
    .innerJoin(users, eq(users.id, stories.creatorId))
    .leftJoin(profiles, eq(profiles.userId, stories.creatorId))
    .where(and(shown, gt(stories.expiresAt, sql`now()`), isNull(stories.removedAt), isNull(users.suspendedAt)))
    .orderBy(asc(stories.createdAt))
    .limit(500);

  const allowed = await Promise.all(rows.map((r) => canViewStory(r.story, viewerId)));
  const visible = rows.filter((_, i) => allowed[i]);
  if (visible.length === 0) return [];

  const ids = visible.map((r) => r.story.id);
  const [seenRows, likedRows] = viewerId
    ? await Promise.all([
        db.select({ storyId: storyViews.storyId }).from(storyViews).where(and(inArray(storyViews.storyId, ids), eq(storyViews.viewerKey, `u:${viewerId}`))),
        db.select({ storyId: storyLikes.storyId }).from(storyLikes).where(and(inArray(storyLikes.storyId, ids), eq(storyLikes.userId, viewerId))),
      ])
    : [[], []];
  const seen = new Set(seenRows.map((r) => r.storyId));
  const liked = new Set(likedRows.map((r) => r.storyId));

  const rings = new Map<string, StoryRing>();
  for (const r of visible) {
    let ring = rings.get(r.story.creatorId);
    if (!ring) {
      ring = {
        creatorId: r.story.creatorId,
        username: r.username,
        displayName: r.displayName,
        avatarUrl: signMediaUrl(r.avatarUrl),
        isOwn: r.story.creatorId === viewerId,
        allSeen: true,
        stories: [],
      };
      rings.set(r.story.creatorId, ring);
    }
    const state = storyState(r.story.status);
    // Nothing is signed before the video is playable.
    const media = state === "ready" ? playable(r.story) : { url: "", thumbnailUrl: null };
    const item: StoryItem = {
      id: r.story.id,
      type: r.story.mediaType === "VIDEO" ? "video" : "image",
      state,
      url: media.url,
      thumbnailUrl: media.thumbnailUrl,
      caption: r.story.caption ?? "",
      durationSeconds: r.story.durationSeconds,
      createdAt: r.story.createdAt,
      expiresAt: r.story.expiresAt,
      viewsCount: r.story.viewsCount,
      likesCount: r.story.likesCount,
      seen: seen.has(r.story.id),
      liked: liked.has(r.story.id),
    };
    ring.stories.push(item);
    if (!item.seen && !ring.isOwn) ring.allSeen = false;
  }
  return [...rings.values()].sort((a, b) => Number(b.isOwn) - Number(a.isOwn) || Number(a.allSeen) - Number(b.allSeen));
}

/** Only verified creators publish stories (the same rule as videos). */
async function requireVerifiedCreator(userId: string) {
  const [account] = await db.select({ role: users.role, isVerified: users.isVerified, username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
  if (!account || (account.role !== "CREATOR" && account.role !== "ADMIN")) throw new HttpError(403, "Only creators publish stories");
  if (!account.isVerified) throw new HttpError(403, "Creator verification (18 U.S.C. § 2257 records) is pending");
  return account;
}

async function checkAudience(creatorId: string, audience: StoryAudience, audienceListId: string | null | undefined) {
  if (audience !== "INVITED_ONLY") return null;
  if (!audienceListId) throw new HttpError(400, "Choose the list this story is shared with");
  const [list] = await db.select({ id: audienceLists.id }).from(audienceLists).where(and(eq(audienceLists.id, audienceListId), eq(audienceLists.ownerId, creatorId))).limit(1);
  if (!list) throw new HttpError(404, "List not found");
  return list.id;
}

export interface NewStory {
  caption?: string | null;
  audience: StoryAudience;
  audienceListId?: string | null;
  contentRatingId?: string | null;
  isBlurred?: boolean;
}

/** An image story: the image was stored first by /api/uploads (category "stories"); its URL is derived from the reference. */
export async function createImageStory(creatorId: string, input: NewStory & { imageRef: string }) {
  await requireVerifiedCreator(creatorId);
  if (!/^stories\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(input.imageRef)) throw new HttpError(400, "Upload the image first");
  const imageUrl = publicUrlForRef(input.imageRef);
  const listId = await checkAudience(creatorId, input.audience, input.audienceListId);
  const [row] = await db
    .insert(stories)
    .values({
      creatorId,
      mediaType: "IMAGE",
      mediaUrl: imageUrl,
      thumbnailUrl: imageUrl,
      caption: input.caption?.trim().slice(0, 280) || null,
      visibility: input.audience,
      audienceListId: listId,
      contentRatingId: input.contentRatingId || null,
      isBlurred: Boolean(input.isBlurred),
      status: "READY",
      expiresAt: new Date(Date.now() + STORY_LIFETIME_MS),
    })
    .returning({ id: stories.id });
  return row;
}

/**
 * A video story: records the story (PENDING_UPLOAD) and opens a Tus session straight to Bunny, in the
 * stories collection, titled so it is easy to find there ("story · @username · <id>").
 */
export async function openVideoStoryUpload(creatorId: string, input: NewStory) {
  const account = await requireVerifiedCreator(creatorId);
  const listId = await checkAudience(creatorId, input.audience, input.audienceListId);
  const config = requireBunnyStream();
  const [row] = await db
    .insert(stories)
    .values({
      creatorId,
      mediaType: "VIDEO",
      caption: input.caption?.trim().slice(0, 280) || null,
      visibility: input.audience,
      audienceListId: listId,
      contentRatingId: input.contentRatingId || null,
      isBlurred: Boolean(input.isBlurred),
      status: "PENDING_UPLOAD",
      expiresAt: new Date(Date.now() + STORY_LIFETIME_MS),
    })
    .returning({ id: stories.id });
  try {
    const client = new BunnyStreamClient(config);
    const session = await client.createTusUploadSession(`story · @${account.username} · ${row.id}`, 7200, config.storiesCollectionId ?? config.collectionId);
    await db.update(stories).set({ bunnyVideoId: session.videoGuid, updatedAt: new Date() }).where(eq(stories.id, row.id));
    return { storyId: row.id, session };
  } catch (error) {
    await db.delete(stories).where(eq(stories.id, row.id));
    throw error;
  }
}

/** Called by the Bunny webhook for a story video: READY starts its 24 hours. */
export async function applyStoryEncoding(bunnyVideoId: string, target: "PROCESSING" | "READY" | "FAILED", details?: { durationSeconds?: number }) {
  const [story] = await db.select().from(stories).where(eq(stories.bunnyVideoId, bunnyVideoId)).limit(1);
  if (!story) return null;
  // Late, repeated or out-of-order events (and a webhook racing the reconciliation) change nothing.
  if (story.status === target || (story.status === "READY" && target === "PROCESSING")) return story.id;
  await db
    .update(stories)
    .set({
      status: target,
      ...(target === "READY"
        ? { expiresAt: new Date(Date.now() + STORY_LIFETIME_MS), durationSeconds: Math.min(Math.round(details?.durationSeconds ?? 0), 600) }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(stories.id, story.id));
  return story.id;
}

/**
 * Settles a story video Bunny reports finished: reads its length, refuses (FAILED, deleted at Bunny)
 * one longer than a story may be — the browser checks, but a client can lie — else makes it READY.
 * Shared by the webhook and the reconciliation below.
 */
export async function settleStoryVideo(
  bunnyVideoId: string,
  target: "PROCESSING" | "READY" | "FAILED",
  client: Pick<BunnyStreamClient, "getVideo" | "deleteVideo">,
  knownDurationSeconds?: number,
) {
  let durationSeconds = knownDurationSeconds;
  if (target === "READY" && durationSeconds === undefined) {
    durationSeconds = await client
      .getVideo(bunnyVideoId)
      .then((d) => d.length)
      .catch(() => undefined);
  }
  const tooLong = target === "READY" && durationSeconds !== undefined && exceedsLength("story", durationSeconds);
  const storyId = await applyStoryEncoding(bunnyVideoId, tooLong ? "FAILED" : target, { durationSeconds });
  if (storyId && tooLong) await client.deleteVideo(bunnyVideoId).catch(() => undefined);
  return storyId ? { storyId, status: tooLong ? ("FAILED" as const) : target, durationSeconds } : null;
}

/** A story video unsettled for this long is asked about at Bunny (its webhook may never come). */
export const STORY_RECHECK_AFTER_MS = 20_000;
/** A Tus session lives 2 hours: a video Bunny still holds no bytes for after that was abandoned. */
export const STORY_UPLOAD_WINDOW_MS = 2 * 3600 * 1000;

/** What Bunny's answer about an unsettled story video means (pure: decided here, applied below). */
export function reconcileDecision(
  story: { status: StoryRow["status"]; createdAt: Date },
  bunny: { missing: true } | { status: number },
  now = new Date(),
): "PROCESSING" | "READY" | "FAILED" | null {
  if ("missing" in bunny) return "FAILED";
  const target = mapBunnyApiStatusToOrochia(bunny.status);
  if (target === null) return now.getTime() - story.createdAt.getTime() > STORY_UPLOAD_WINDOW_MS ? "FAILED" : null;
  return target === story.status ? null : target;
}

/**
 * Catch-up for lost webhooks. Bunny reports encoding through its webhook only; when that never
 * arrives — a library without a webhook URL, an app Bunny cannot reach (localhost), a delivery lost —
 * a story stayed PENDING_UPLOAD forever and its author never saw it. This asks the Stream API about
 * video stories still unsettled after STORY_RECHECK_AFTER_MS and applies what it says, exactly as the
 * webhook would. Each story is claimed (its updated_at moved) before the call, so concurrent requests
 * and instances never ask twice, and a story is asked about at most once per STORY_RECHECK_AFTER_MS.
 * Never throws: an unreachable Bunny leaves the stories for the next pass.
 */
export async function reconcileStoryVideos(
  options: { creatorId?: string; limit?: number; client?: Pick<BunnyStreamClient, "getVideo" | "deleteVideo"> } = {},
): Promise<{ checked: number; settled: number }> {
  if (!process.env.BUNNY_STREAM_API_KEY?.trim()) return { checked: 0, settled: 0 };
  const stale = new Date(Date.now() - STORY_RECHECK_AFTER_MS);
  const candidates = await db
    .select({ id: stories.id, bunnyVideoId: stories.bunnyVideoId, status: stories.status, createdAt: stories.createdAt })
    .from(stories)
    .where(
      and(
        eq(stories.mediaType, "VIDEO"),
        inArray(stories.status, ["PENDING_UPLOAD", "PROCESSING"]),
        isNotNull(stories.bunnyVideoId),
        isNull(stories.removedAt),
        gt(stories.expiresAt, sql`now()`),
        lt(stories.updatedAt, stale),
        options.creatorId ? eq(stories.creatorId, options.creatorId) : undefined,
      ),
    )
    .orderBy(asc(stories.updatedAt))
    .limit(options.limit ?? 10);
  if (candidates.length === 0) return { checked: 0, settled: 0 };
  const client = options.client ?? new BunnyStreamClient(bunnyStreamConfig());

  const results = await Promise.all(
    candidates.map(async (story) => {
      const guid = story.bunnyVideoId!;
      const [claimed] = await db
        .update(stories)
        .set({ updatedAt: new Date() })
        // Still unsettled and not asked about since (compared in SQL: updated_at keeps microseconds a JS Date drops).
        .where(and(eq(stories.id, story.id), inArray(stories.status, ["PENDING_UPLOAD", "PROCESSING"]), lt(stories.updatedAt, stale)))
        .returning({ id: stories.id });
      if (!claimed) return false;
      try {
        const video = await client.getVideo(guid).then(
          (v) => ({ status: v.status, length: v.length }),
          (error: unknown) => {
            if (error instanceof BunnyApiError && error.status === 404) return { missing: true as const };
            throw error;
          },
        );
        const target = reconcileDecision(story, video);
        if (!target) return false;
        const settled = await settleStoryVideo(guid, target, client, "length" in video ? video.length : undefined);
        if (settled) console.info(`stories: ${story.id} reconciled with Bunny → ${settled.status} (webhook missing)`);
        return Boolean(settled);
      } catch (error) {
        console.warn(`stories: could not reconcile ${story.id} with Bunny`, error instanceof Error ? error.message : error);
        return false;
      }
    }),
  );
  return { checked: candidates.length, settled: results.filter(Boolean).length };
}

async function visibleStory(storyId: string, viewerId: string | null) {
  const [story] = await db.select().from(stories).where(and(eq(stories.id, storyId), isNull(stories.removedAt))).limit(1);
  if (!story || story.status !== "READY" || story.expiresAt <= new Date() || !(await canViewStory(story, viewerId))) {
    throw new HttpError(404, "Story not found");
  }
  return story;
}

/** Counts a story view once per viewer; the creator's own views never count. */
export async function recordStoryView(storyId: string, viewerId: string | null, network: { ip: string | null; userAgent: string | null }) {
  const story = await visibleStory(storyId, viewerId);
  if (viewerId === story.creatorId) return false;
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(storyViews)
      .values({ storyId, viewerId, viewerKey: viewerKey(viewerId, network) })
      .onConflictDoNothing()
      .returning({ id: storyViews.id });
    if (inserted.length === 0) return false;
    await tx.update(stories).set({ viewsCount: sql`${stories.viewsCount} + 1` }).where(eq(stories.id, storyId));
    return true;
  });
}

export async function setStoryLike(storyId: string, userId: string, liked: boolean) {
  await visibleStory(storyId, userId);
  return db.transaction(async (tx) => {
    const changed = liked
      ? await tx.insert(storyLikes).values({ storyId, userId }).onConflictDoNothing().returning({ id: storyLikes.id })
      : await tx.delete(storyLikes).where(and(eq(storyLikes.storyId, storyId), eq(storyLikes.userId, userId))).returning({ id: storyLikes.id });
    const delta = changed.length === 0 ? 0 : liked ? 1 : -1;
    const [row] = await tx
      .update(stories)
      .set({ likesCount: sql`greatest(${stories.likesCount} + ${delta}, 0)` })
      .where(eq(stories.id, storyId))
      .returning({ likesCount: stories.likesCount });
    return { liked, likesCount: row.likesCount };
  });
}

/** The creator (or an operator) withdraws a story; its Bunny video stays in the stories collection for the record. */
export async function removeStory(storyId: string, user: { id: string; role: string }) {
  const [story] = await db.select({ creatorId: stories.creatorId }).from(stories).where(and(eq(stories.id, storyId), isNull(stories.removedAt))).limit(1);
  if (!story || (story.creatorId !== user.id && user.role !== "ADMIN")) throw new HttpError(404, "Story not found");
  await db.update(stories).set({ removedAt: new Date(), updatedAt: new Date() }).where(eq(stories.id, storyId));
}

/** The creator's own stories (live, encoding or expired in the last 30 days), newest first. */
export async function myStories(creatorId: string) {
  return db
    .select({
      id: stories.id,
      mediaType: stories.mediaType,
      caption: stories.caption,
      visibility: stories.visibility,
      status: stories.status,
      viewsCount: stories.viewsCount,
      likesCount: stories.likesCount,
      expiresAt: stories.expiresAt,
      createdAt: stories.createdAt,
    })
    .from(stories)
    .where(and(eq(stories.creatorId, creatorId), isNull(stories.removedAt), gt(stories.createdAt, sql`now() - interval '30 days'`)))
    .orderBy(desc(stories.createdAt))
    .limit(100);
}
