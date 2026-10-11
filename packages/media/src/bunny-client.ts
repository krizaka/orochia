import crypto from "crypto";
import {
  BunnyConfig,
  BunnyVideoPage,
  BunnyVideoResponse,
  TusDirectUploadSession,
  SignedHlsStreamUrl,
} from "./types";
import { generateBunnyStreamToken } from "./token-auth";

/** A Bunny Stream API answer other than 2xx; `status` tells a missing video (404) from an outage. */
export class BunnyApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "BunnyApiError";
  }
}

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
      throw new BunnyApiError(response.status, `Bunny Stream Get Video Error (${response.status}): ${errText}`);
    }

    return (await response.json()) as BunnyVideoResponse;
  }

  /**
   * Lists the library, one page at a time (`GET /library/{id}/videos`): each item carries `storageSize` (bytes,
   * renditions included) and `length` (seconds). One request per page of up to 1000 videos — what the storage
   * reconciliation reads, never the upload path.
   */
  async listVideos(page = 1, itemsPerPage = 1000): Promise<BunnyVideoPage> {
    const url = `${this.baseUrl}/library/${this.libraryId}/videos?page=${page}&itemsPerPage=${itemsPerPage}&orderBy=date`;
    const response = await fetch(url, { headers: { AccessKey: this.apiKey, Accept: "application/json" } });
    if (!response.ok) {
      throw new BunnyApiError(response.status, `Bunny Stream List Videos Error (${response.status}): ${await response.text()}`);
    }
    return (await response.json()) as BunnyVideoPage;
  }

  /** Every video of the library (pages of 1000, at most `maxPages`). */
  async listAllVideos(maxPages = 200): Promise<BunnyVideoResponse[]> {
    const all: BunnyVideoResponse[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const result = await this.listVideos(page, 1000);
      all.push(...(result.items ?? []));
      if (!result.items?.length || all.length >= result.totalItems) break;
    }
    return all;
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
    validitySeconds = 7200,
    /** Bunny collection to file the video in (defaults to the configured one). */
    collectionId: string | undefined = this.collectionId
  ): Promise<TusDirectUploadSession> {
    const video = await this.createVideo(title, collectionId);
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
