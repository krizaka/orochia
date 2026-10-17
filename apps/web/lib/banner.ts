import { HttpError } from "./http";

/**
 * A profile cover is a still (`image`), a 3-6 s moment of the creator's own published video (`video_segment`) or one of
 * the ambient loops we provide (`ambient`). The still always stays as the poster (`profiles.banner_url`), so lists,
 * cards, crawlers and old clients keep showing a picture. See krizaka/orochia#284.
 */
export const BANNER_KINDS = ["image", "video_segment", "ambient"] as const;
export type BannerKind = (typeof BANNER_KINDS)[number];
const [IMAGE, , AMBIENT] = BANNER_KINDS;
const VIDEO_READY = "READY";
const VIDEO_PUBLIC = "PUBLIC";

// @fixed: product rule of the cover (krizaka/orochia#284): short enough for a ~600 KB loop, long enough to read as a moment.
export const SEGMENT_MIN_SECONDS = 3;
// @fixed: same rule, upper bound.
export const SEGMENT_MAX_SECONDS = 6;

/** The ambient loops (Wan I2V from the banner stills): none yet, they wait for the GPU slot. Same data shape as the pictures. */
export const AMBIENT_BANNERS: readonly { id: string }[] = [];

/** Deployment switch, read at request time: `APP_VIDEO_BANNER=on` (off by default). */
export function videoBannerEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.APP_VIDEO_BANNER?.trim().toLowerCase() === "on";
}

export interface BannerChoice {
  kind: BannerKind;
  videoId?: string | null;
  startSeconds?: number | null;
  endSeconds?: number | null;
  ambientId?: string | null;
}

export interface ResolvedBanner {
  kind: BannerKind;
  videoId: string | null;
  startSeconds: number | null;
  endSeconds: number | null;
  ambientId: string | null;
}

export interface BannerVideo {
  id: string;
  creatorId: string;
  status: string;
  durationSeconds: number;
  removedAt: Date | null;
  /** A cover is public: only a PUBLIC, free video can be one. */
  visibility: string;
  minTipAmountCents: number;
}

const CLEARED = { videoId: null, startSeconds: null, endSeconds: null, ambientId: null };

/**
 * What the server stores for a choice, or a 400. The caller passes the video row the choice names (read by id) — the
 * client never sets a URL. The columns of the other kinds are always cleared.
 */
export function resolveBannerChoice(
  choice: BannerChoice,
  ctx: { userId: string; video: BannerVideo | null },
  ambient: readonly { id: string }[] = AMBIENT_BANNERS,
): ResolvedBanner {
  if (choice.kind === IMAGE) return { kind: "image", ...CLEARED };
  if (choice.kind === AMBIENT) {
    if (!choice.ambientId || !ambient.some((a) => a.id === choice.ambientId)) throw new HttpError(400, "Choose one of the ambient loops");
    return { kind: "ambient", ...CLEARED, ambientId: choice.ambientId };
  }
  const { video } = ctx;
  if (!video || video.id !== choice.videoId) throw new HttpError(400, "Choose one of your videos");
  if (video.creatorId !== ctx.userId) throw new HttpError(403, "A cover can only use your own videos");
  if (video.status !== VIDEO_READY || video.removedAt || video.visibility !== VIDEO_PUBLIC || video.minTipAmountCents > 0) {
    throw new HttpError(400, "Only a published, public and free video can be used as a cover");
  }
  const start = choice.startSeconds;
  const end = choice.endSeconds;
  if (typeof start !== "number" || typeof end !== "number" || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
    throw new HttpError(400, "Choose where the moment starts and ends");
  }
  const length = end - start;
  if (length < SEGMENT_MIN_SECONDS) throw new HttpError(400, `The moment must last at least ${SEGMENT_MIN_SECONDS} seconds`);
  if (length > SEGMENT_MAX_SECONDS) throw new HttpError(400, `The moment can last at most ${SEGMENT_MAX_SECONDS} seconds`);
  if (end > video.durationSeconds) throw new HttpError(400, "The moment runs past the end of the video (duration)");
  return { kind: "video_segment", ...CLEARED, videoId: video.id, startSeconds: start, endSeconds: end };
}

export { type PlaybackContext, bannerPlayback } from "./banner-playback";
