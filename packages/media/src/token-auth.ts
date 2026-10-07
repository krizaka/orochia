import crypto from "crypto";
import { SignedHlsStreamUrl } from "./types";

export interface GenerateStreamTokenOptions {
  hostname: string;
  videoGuid: string;
  tokenAuthKey: string;
  expiresInSeconds?: number;
  userIp?: string;
}

/**
 * Signs a Bunny CDN token for one video's directory, so the playlist, its renditions and every
 * segment are authorised by the same token until it expires.
 *
 * The token sits in the path (`/bcdn_token=…&expires=…&token_path=…/<guid>/playlist.m3u8`), not in
 * the query string: HLS players request renditions and segments by relative URL, which keeps the
 * path prefix but drops the query — a query token would authorise the playlist only.
 * Hash: SHA-256 of key + signed path + expiry + [ip] + "token_path=<path>", URL-safe base64.
 */
export function generateBunnyStreamToken({
  hostname,
  videoGuid,
  tokenAuthKey,
  expiresInSeconds = 3600 * 4, // 4 hours default playback window
  userIp,
}: GenerateStreamTokenOptions): SignedHlsStreamUrl {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const path = `/${videoGuid}/`;
  const hashableBase = `${tokenAuthKey}${path}${expires}${userIp ?? ""}token_path=${path}`;

  const rawHash = crypto.createHash("sha256").update(hashableBase).digest("base64");
  
  // Transform base64 to URL-safe format expected by Bunny.net Edge Auth
  const token = rawHash
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const streamUrl = `https://${hostname}/${videoGuid}/playlist.m3u8`;
  const directM3u8Url = `https://${hostname}/bcdn_token=${token}&expires=${expires}&token_path=${encodeURIComponent(path)}${path}playlist.m3u8`;

  return {
    streamUrl,
    token,
    expires,
    directM3u8Url,
  };
}
