import { z } from "zod";

export const BunnyConfigSchema = z.object({
  apiKey: z.string().min(1, "Bunny Stream API key is required"),
  libraryId: z.coerce.number().positive("Bunny Library ID must be positive"),
  hostname: z.string().min(1, "Bunny Hostname is required"),
  tokenAuthKey: z.string().min(1, "Token Auth key is required"),
  webhookSecret: z.string().optional(),
  /** Bunny collection every new video is filed in (optional). */
  collectionId: z.string().uuid().optional(),
  /** Bunny collection story videos are filed in (optional; the main collection otherwise). */
  storiesCollectionId: z.string().uuid().optional(),
});

export type BunnyConfig = z.infer<typeof BunnyConfigSchema>;

export const CreateUploadSessionSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().optional(),
  visibility: z.enum(["PUBLIC", "CONTACTS_ONLY", "APPROVED_FOLLOWERS_ONLY", "TIPPED_UNLOCKED", "INVITED_ONLY"]),
  minTipAmountCents: z.number().int().nonnegative().default(0),
  tags: z.array(z.string()).default([]),
});

export type CreateUploadSessionInput = z.infer<typeof CreateUploadSessionSchema>;

export interface BunnyVideoResponse {
  videoLibraryId: number;
  guid: string;
  title: string;
  dateUploaded: string;
  views: number;
  isPublic: boolean;
  length: number;
  status: number; // 0 = Created, 1 = Uploaded, 2 = Processing, 3 = Transcoding, 4 = Finished, 5 = Error
  framerate: number;
  width: number;
  height: number;
  availableResolutions: string;
  thumbnailCount: number;
  encodeProgress: number;
  storageSize: number;
  hasMP4Fallback: boolean;
  /** File name of the chosen thumbnail inside the video folder (e.g. "thumbnail.jpg"). */
  thumbnailFileName?: string;
}

export interface TusDirectUploadSession {
  videoGuid: string;
  libraryId: number;
  tusEndpoint: string;
  expiresAt: number;
  authSignature: string;
  headers: {
    AuthorizationSignature: string;
    AuthorizationExpire: number;
    VideoId: string;
    LibraryId: string;
  };
}

/**
 * A Bunny Stream webhook (https://bunny.net/docs/stream/webhooks): the library, the video and a
 * status code — nothing else. Details (length, resolutions) are read from the API when needed.
 * Status: 0 queued · 1 processing · 2 encoding · 3 finished · 4 one resolution finished · 5 failed ·
 * 6/7/8 pre-signed upload started/finished/failed · 9 captions generated · 10 title/description generated.
 */
export const BunnyWebhookPayloadSchema = z.object({
  VideoLibraryId: z.number(),
  VideoGuid: z.string().uuid(),
  Status: z.number().int(),
});

export type BunnyWebhookPayload = z.infer<typeof BunnyWebhookPayloadSchema>;

export interface SignedHlsStreamUrl {
  streamUrl: string;
  token: string;
  expires: number;
  directM3u8Url: string;
}
