import crypto from "crypto";
import {
  BunnyConfig,
  BunnyVideoResponse,
  TusDirectUploadSession,
  SignedHlsStreamUrl,
} from "./types";
import { generateBunnyStreamToken } from "./token-auth";

export class BunnyStreamClient {
  private apiKey: string;
  private libraryId: number;
  private hostname: string;
  private tokenAuthKey: string;
  private collectionId?: string;
  private baseUrl: string;

  constructor(config: BunnyConfig) {
    this.apiKey = config.apiKey;
    this.libraryId = config.libraryId;
    this.hostname = config.hostname;
    this.tokenAuthKey = config.tokenAuthKey;
    this.collectionId = config.collectionId;
    this.baseUrl = "https://video.bunnycdn.com";
  }

  /**
   * Allocates a new video slot in Bunny.net Stream library.
   */
  async createVideo(title: string, collectionId = this.collectionId): Promise<BunnyVideoResponse> {
    const response = await fetch(`${this.baseUrl}/library/${this.libraryId}/videos`, {
      method: "POST",
      headers: {
        AccessKey: this.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        title,
        collectionId: collectionId || undefined,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Bunny Stream API Error (${response.status}): ${errText}`);
    }

    return (await response.json()) as BunnyVideoResponse;
  }

  /**
   * Fetches encoding and playback metadata for a video.
   */
  async getVideo(videoGuid: string): Promise<BunnyVideoResponse> {
    const response = await fetch(
      `${this.baseUrl}/library/${this.libraryId}/videos/${videoGuid}`,
      {
        method: "GET",
        headers: {
          AccessKey: this.apiKey,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Bunny Stream Get Video Error (${response.status}): ${errText}`);
    }

    return (await response.json()) as BunnyVideoResponse;
  }

  /**
   * Deletes a video and all encoded renditions from Bunny CDN.
   */
  async deleteVideo(videoGuid: string): Promise<boolean> {
    const response = await fetch(
      `${this.baseUrl}/library/${this.libraryId}/videos/${videoGuid}`,
      {
        method: "DELETE",
        headers: {
          AccessKey: this.apiKey,
        },
      }
    );

    return response.ok;
  }

  /**
   * Provisions direct-to-Bunny Tus resumable upload credentials.
   * This authorizes the creator's browser to stream the raw media bytes directly to
   * Bunny's global edge network without passing through application server memory.
   */
  async createTusUploadSession(
    title: string,
    validitySeconds = 7200
  ): Promise<TusDirectUploadSession> {
    const video = await this.createVideo(title);
    const expiresAt = Math.floor(Date.now() / 1000) + validitySeconds;

    // Bunny Tus Authorization Signature algorithm:
    // SHA256(libraryId + apiKey + expiration + videoId)
    const rawSignatureBase = `${this.libraryId}${this.apiKey}${expiresAt}${video.guid}`;
    const authSignature = crypto
      .createHash("sha256")
      .update(rawSignatureBase)
      .digest("hex");

    return {
      videoGuid: video.guid,
      libraryId: this.libraryId,
      tusEndpoint: "https://video.bunnycdn.com/tusupload",
      expiresAt,
      authSignature,
      headers: {
        AuthorizationSignature: authSignature,
        AuthorizationExpire: expiresAt,
        VideoId: video.guid,
        LibraryId: String(this.libraryId),
      },
    };
  }

  /**
   * Generates a signed HLS playback token for an authorized viewer.
   */
  getSignedStreamUrl(videoGuid: string, expiresInSeconds = 14400, userIp?: string): SignedHlsStreamUrl {
    return generateBunnyStreamToken({
      hostname: this.hostname,
      videoGuid,
      tokenAuthKey: this.tokenAuthKey,
      expiresInSeconds,
      userIp,
    });
  }
}
