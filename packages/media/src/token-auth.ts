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
 * Generates an HMAC-SHA256 expiring token for Bunny.net Stream HLS playlist delivery.
 * Enforces token expiration and path authorization so that paywalled or private videos
 * cannot be accessed or hotlinked without verified server authorization.
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

  // Bunny Token Authentication algorithm:
  // SHA256 of: tokenKey + path + expires + [userIp]
  const hashableBase = `${tokenAuthKey}${path}${expires}${userIp ? userIp : ""}`;
  
  const rawHash = crypto.createHash("sha256").update(hashableBase).digest("base64");
  
  // Transform base64 to URL-safe format expected by Bunny.net Edge Auth
  const token = rawHash
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const streamUrl = `https://${hostname}/${videoGuid}/playlist.m3u8`;
  const directM3u8Url = `${streamUrl}?token=${token}&expires=${expires}`;

  return {
    streamUrl,
    token,
    expires,
    directM3u8Url,
  };
}
