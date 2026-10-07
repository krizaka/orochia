import { signBunnyFileUrl } from "@orochia/media";
import { bunnyStreamConfig } from "./env";

/**
 * Thumbnails and preview animations live on the Stream CDN, which refuses unsigned requests (CDN
 * token authentication). Each one is signed on its own — a file token never opens the video's
 * renditions — in 6-hour windows, so the URL stays cacheable. Other hosts (local uploads, the
 * storage pull zone) are returned as they are.
 */
export function signMediaUrl(url: string | null): string | null {
  if (!url) return url;
  let config: ReturnType<typeof bunnyStreamConfig>;
  try {
    config = bunnyStreamConfig();
  } catch {
    return url;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.hostname !== config.hostname) return url;
  return signBunnyFileUrl({ hostname: config.hostname, path: parsed.pathname, tokenAuthKey: config.tokenAuthKey });
}

type WithMedia = { thumbnailUrl?: string | null; previewAnimationUrl?: string | null; coverUrl?: string | null };

/** The same row with its media URLs signed. */
export function withSignedMedia<T extends WithMedia>(row: T): T {
  const out = { ...row };
  if ("thumbnailUrl" in out) out.thumbnailUrl = signMediaUrl(out.thumbnailUrl ?? null);
  if ("previewAnimationUrl" in out) out.previewAnimationUrl = signMediaUrl(out.previewAnimationUrl ?? null);
  if ("coverUrl" in out) out.coverUrl = signMediaUrl(out.coverUrl ?? null);
  return out;
}
