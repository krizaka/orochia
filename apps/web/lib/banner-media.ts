import { db, profiles, videos } from "@orochia/db";
import { signBunnyFeedMp4Url } from "@orochia/media";
import { and, eq, isNull } from "drizzle-orm";

import { videoBannerEnabled } from "./banner";
import type { BannerVideoView } from "./banner-types";
import { bunnyStreamConfig } from "./env";

/**
 * The moving cover of a profile, ready for the page: only when the switch is on, the profile's cover is a moment of a
 * video, and that video is still the creator's own, published (READY), public, free and not removed. Anything else is
 * `null` and the profile shows its still. The URL is signed here, at render (the feed's 10-minute window).
 */
export async function bannerVideoFor(userId: string): Promise<BannerVideoView | null> {
  if (!videoBannerEnabled()) return null;
  const [row] = await db
    .select({
      kind: profiles.bannerKind,
      start: profiles.bannerStartSeconds,
      end: profiles.bannerEndSeconds,
      guid: videos.bunnyVideoId,
      resolutions: videos.resolutions,
    })
    .from(profiles)
    .innerJoin(videos, and(eq(videos.id, profiles.bannerVideoId), eq(videos.creatorId, profiles.userId)))
    .where(and(eq(profiles.userId, userId), eq(profiles.bannerKind, "video_segment"), eq(videos.status, "READY"), eq(videos.visibility, "PUBLIC"), eq(videos.minTipAmountCents, 0), isNull(videos.removedAt)))
    .limit(1);
  if (!row || row.start == null || row.end == null) return null;
  const config = bunnyStreamConfig();
  const url = signBunnyFeedMp4Url({ hostname: config.hostname, videoGuid: row.guid, tokenAuthKey: config.tokenAuthKey, resolutions: row.resolutions });
  return { src: `${url}#t=${row.start},${row.end}`, startSeconds: row.start, endSeconds: row.end };
}
