import { db, videos, videoAccessGrants, contacts, follows } from "@orochia/db";
import { isInvited } from "./audiences";
import { eq, and, or } from "drizzle-orm";

export interface AccessEvaluation {
  allowed: boolean;
  reason?: "PAYWALL_REQUIRED" | "CONTACTS_ONLY" | "FOLLOWERS_ONLY" | "INVITED_ONLY" | "AUCTION" | "AGE_VERIFICATION_REQUIRED" | "NOT_FOUND";
  minTipAmountCents?: number;
  creatorId?: string;
  videoTitle?: string;
}

/** The creator accepted this viewer's follow. */
export async function isApprovedFollower(viewerId: string, creatorId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followerId, viewerId), eq(follows.creatorId, creatorId), eq(follows.status, "APPROVED")))
    .limit(1);
  return Boolean(row);
}

/** An accepted contact, whichever side asked. */
export async function areContacts(a: string, b: string): Promise<boolean> {
  const [row] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      and(
        eq(contacts.status, "ACCEPTED"),
        or(and(eq(contacts.requesterId, a), eq(contacts.addresseeId, b)), and(eq(contacts.requesterId, b), eq(contacts.addresseeId, a))),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export type CollectionVisibility = "PUBLIC" | "APPROVED_FOLLOWERS_ONLY" | "CONTACTS_ONLY" | "INVITED_ONLY" | "PRIVATE";

/**
 * Whether a viewer may open a collection. Opening it lists its videos; playing each one is still
 * decided by {@link evaluateVideoAccess} — a collection never grants playback.
 */
export async function canOpenCollection(
  collection: { id: string; ownerId: string; visibility: CollectionVisibility },
  viewerId: string | null | undefined,
): Promise<boolean> {
  if (viewerId && viewerId === collection.ownerId) return true;
  if (collection.visibility === "PUBLIC") return true;
  if (!viewerId || collection.visibility === "PRIVATE") return false;
  if (collection.visibility === "APPROVED_FOLLOWERS_ONLY") return isApprovedFollower(viewerId, collection.ownerId);
  if (collection.visibility === "CONTACTS_ONLY") return areContacts(viewerId, collection.ownerId);
  return isInvited("collection", collection.id, viewerId);
}

/**
 * Evaluates whether a viewer has permission to stream a video.
 * Enforces zero-trust IDOR prevention on media assets.
 */
export async function evaluateVideoAccess(
  videoId: string,
  viewerId?: string | null
): Promise<AccessEvaluation> {
  const [video] = await db
    .select()
    .from(videos)
    .where(eq(videos.id, videoId))
    .limit(1);

  // A taken-down video does not exist for anyone, its author included.
  if (!video || video.removedAt) {
    return { allowed: false, reason: "NOT_FOUND" };
  }

  // 1. Author has unrestricted access to their own content
  if (viewerId && video.creatorId === viewerId) {
    return { allowed: true, creatorId: video.creatorId, videoTitle: video.title };
  }

  // 2. Public video
  if (video.visibility === "PUBLIC") {
    return { allowed: true, creatorId: video.creatorId, videoTitle: video.title };
  }

  // From here on, viewer must be authenticated
  if (!viewerId) {
    if (video.visibility === "TIPPED_UNLOCKED") {
      return {
        allowed: false,
        reason: "PAYWALL_REQUIRED",
        minTipAmountCents: video.minTipAmountCents,
        creatorId: video.creatorId,
        videoTitle: video.title,
      };
    }
    if (video.visibility === "APPROVED_FOLLOWERS_ONLY") {
      return { allowed: false, reason: "FOLLOWERS_ONLY", creatorId: video.creatorId, videoTitle: video.title };
    }
    if (video.visibility === "INVITED_ONLY") {
      return { allowed: false, reason: "INVITED_ONLY", creatorId: video.creatorId, videoTitle: video.title };
    }
    if (video.visibility === "AUCTION") {
      return { allowed: false, reason: "AUCTION", creatorId: video.creatorId, videoTitle: video.title };
    }
    return { allowed: false, reason: "CONTACTS_ONLY", creatorId: video.creatorId, videoTitle: video.title };
  }

  // 3. Approved-followers video check: the creator accepted this viewer's follow.
  if (video.visibility === "APPROVED_FOLLOWERS_ONLY") {
    return (await isApprovedFollower(viewerId, video.creatorId))
      ? { allowed: true, creatorId: video.creatorId, videoTitle: video.title }
      : { allowed: false, reason: "FOLLOWERS_ONLY", creatorId: video.creatorId, videoTitle: video.title };
  }

  // 4. Contacts-Only video check
  if (video.visibility === "CONTACTS_ONLY") {
    if (await areContacts(viewerId, video.creatorId)) {
      return { allowed: true, creatorId: video.creatorId, videoTitle: video.title };
    }

    return {
      allowed: false,
      reason: "CONTACTS_ONLY",
      creatorId: video.creatorId,
      videoTitle: video.title,
    };
  }

  // 5. Invited viewers: one by one, or through one of the creator's audience lists.
  if (video.visibility === "INVITED_ONLY") {
    return (await isInvited("video", video.id, viewerId))
      ? { allowed: true, creatorId: video.creatorId, videoTitle: video.title }
      : { allowed: false, reason: "INVITED_ONLY", creatorId: video.creatorId, videoTitle: video.title };
  }

  // 6. Auctioned: only the winning bidder (an access grant written by the sale) — exclusive.
  if (video.visibility === "AUCTION") {
    const [grant] = await db
      .select({ id: videoAccessGrants.id })
      .from(videoAccessGrants)
      .where(and(eq(videoAccessGrants.videoId, videoId), eq(videoAccessGrants.userId, viewerId), eq(videoAccessGrants.grantedVia, "AUCTION")))
      .limit(1);
    return grant
      ? { allowed: true, creatorId: video.creatorId, videoTitle: video.title }
      : { allowed: false, reason: "AUCTION", creatorId: video.creatorId, videoTitle: video.title };
  }

  // 7. Paywalled / Tipped video check
  if (video.visibility === "TIPPED_UNLOCKED") {
    const [grant] = await db
      .select()
      .from(videoAccessGrants)
      .where(
        and(
          eq(videoAccessGrants.videoId, videoId),
          eq(videoAccessGrants.userId, viewerId)
        )
      )
      .limit(1);

    if (grant) {
      return { allowed: true, creatorId: video.creatorId, videoTitle: video.title };
    }

    return {
      allowed: false,
      reason: "PAYWALL_REQUIRED",
      minTipAmountCents: video.minTipAmountCents,
      creatorId: video.creatorId,
      videoTitle: video.title,
    };
  }

  return { allowed: false, reason: "CONTACTS_ONLY", creatorId: video.creatorId, videoTitle: video.title };
}

/** Whether an account may download a video's file: its author, or a buyer whose grant includes downloading. */
export async function canDownloadVideo(videoId: string, userId: string): Promise<boolean> {
  const [video] = await db.select({ creatorId: videos.creatorId, removedAt: videos.removedAt }).from(videos).where(eq(videos.id, videoId)).limit(1);
  if (!video || video.removedAt) return false;
  if (video.creatorId === userId) return true;
  const [grant] = await db
    .select({ id: videoAccessGrants.id })
    .from(videoAccessGrants)
    .where(and(eq(videoAccessGrants.videoId, videoId), eq(videoAccessGrants.userId, userId), eq(videoAccessGrants.canDownload, true)))
    .limit(1);
  return Boolean(grant);
}
