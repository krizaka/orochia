import { db, videos, videoAccessGrants, contacts } from "@orochia/db";
import { eq, and, or } from "drizzle-orm";

export interface AccessEvaluation {
  allowed: boolean;
  reason?: "PAYWALL_REQUIRED" | "CONTACTS_ONLY" | "AGE_VERIFICATION_REQUIRED" | "NOT_FOUND";
  minTipAmountCents?: number;
  creatorId?: string;
  videoTitle?: string;
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

  if (!video) {
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
    return { allowed: false, reason: "CONTACTS_ONLY", creatorId: video.creatorId, videoTitle: video.title };
  }

  // 3. Contacts-Only video check
  if (video.visibility === "CONTACTS_ONLY") {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.status, "ACCEPTED"),
          or(
            and(eq(contacts.requesterId, viewerId), eq(contacts.addresseeId, video.creatorId)),
            and(eq(contacts.requesterId, video.creatorId), eq(contacts.addresseeId, viewerId))
          )
        )
      )
      .limit(1);

    if (contact) {
      return { allowed: true, creatorId: video.creatorId, videoTitle: video.title };
    }

    return {
      allowed: false,
      reason: "CONTACTS_ONLY",
      creatorId: video.creatorId,
      videoTitle: video.title,
    };
  }

  // 4. Paywalled / Tipped video check
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
