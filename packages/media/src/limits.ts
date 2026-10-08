/**
 * How big an upload may be, shared by the browser (checked before anything is sent) and the server (the
 * declared size when a session opens, the encoded length when Bunny reports it). In line with the large
 * platforms: Instagram and TikTok cap a video at 4 GB / 10 GB and one hour; a story is a short clip.
 */
export const UPLOAD_LIMITS = {
  video: { maxBytes: 4 * 1024 ** 3, maxSeconds: 3 * 60 * 60 },
  story: { maxBytes: 250 * 1024 ** 2, maxSeconds: 60 },
  /** An editor draft keeps the original: what the browser editor can open. */
  draft: { maxBytes: 400 * 1024 ** 2, maxSeconds: 3 * 60 * 60 },
} as const;

/** A music track mixed in by the editor (kept privately with its draft). */
export const DRAFT_MUSIC_MAX_BYTES = 25 * 1024 ** 2;

export type UploadKind = keyof typeof UPLOAD_LIMITS;

/** A few seconds of slack: encoders round the length of the last frame. */
export const exceedsLength = (kind: UploadKind, seconds: number) => seconds > UPLOAD_LIMITS[kind].maxSeconds + 2;
