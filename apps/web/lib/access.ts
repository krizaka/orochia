import { db, videos, videoAccessGrants, contacts, follows, playlistMembers } from "@orochia/db";
import { eq, and, or } from "drizzle-orm";

export interface AccessEvaluation {
  allowed: boolean;
  reason?: "PAYWALL_REQUIRED" | "CONTACTS_ONLY" | "FOLLOWERS_ONLY" | "AGE_VERIFICATION_REQUIRED" | "NOT_FOUND";
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
  const [member] = await db
    .select({ id: playlistMembers.id })
    .from(playlistMembers)
    .where(and(eq(playlistMembers.playlistId, collection.id), eq(playlistMembers.userId, viewerId)))
    .limit(1);
  return Boolean(member);
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

  // 5. Paywalled / Tipped video check
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
