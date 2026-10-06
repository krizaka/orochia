import { z } from "zod";

export const BunnyConfigSchema = z.object({
  apiKey: z.string().min(1, "Bunny Stream API key is required"),
  libraryId: z.coerce.number().positive("Bunny Library ID must be positive"),
  hostname: z.string().min(1, "Bunny Hostname is required"),
  tokenAuthKey: z.string().min(1, "Token Auth key is required"),
  webhookSecret: z.string().optional(),
});

export type BunnyConfig = z.infer<typeof BunnyConfigSchema>;

export const CreateUploadSessionSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().optional(),
  visibility: z.enum(["PUBLIC", "CONTACTS_ONLY", "APPROVED_FOLLOWERS_ONLY", "TIPPED_UNLOCKED"]),
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

export const BunnyWebhookPayloadSchema = z.object({
  VideoLibraryId: z.number(),
  VideoGuid: z.string().uuid(),
  Title: z.string().optional(),
  Status: z.number(), // 3 = Processing/Transcoding, 4 = Ready/Finished, 5 = Failed
  StatusCode: z.number().optional(),
  Resolutions: z.array(z.string()).optional(),
  Duration: z.number().optional(),
  ThumbnailUrl: z.string().optional(),
  PreviewAnimationUrl: z.string().optional(),
});

export type BunnyWebhookPayload = z.infer<typeof BunnyWebhookPayloadSchema>;

export interface SignedHlsStreamUrl {
  streamUrl: string;
  token: string;
  expires: number;
  directM3u8Url: string;
}
