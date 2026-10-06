import { ConfigurationError } from "./env";
import fs from "fs";
import path from "path";

export interface UploadResult {
  url: string;
  driver: "local" | "bunny";
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

/**
 * Dual-Mode Storage Service:
 * - Local filesystem folder storage for seamless DevX
 * - Bunny.net Edge Storage for staging and production
 */
export async function uploadMediaFile(
  fileBuffer: Buffer,
  originalFilename: string,
  category: "avatars" | "thumbnails" | "videos" | "documents" = "videos"
): Promise<UploadResult> {
  const driver = process.env.STORAGE_DRIVER === "bunny" ? "bunny" : "local";
  // Container filesystems are ephemeral: production stores media on Bunny Edge Storage only.
  if (process.env.NODE_ENV === "production" && (driver !== "bunny" || !process.env.BUNNY_STORAGE_API_KEY)) {
    throw new ConfigurationError("STORAGE_DRIVER=bunny and BUNNY_STORAGE_API_KEY");
  }
  const ext = path.extname(originalFilename) || (category === "videos" ? ".mp4" : ".jpg");
  const sanitizedName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;

  if (driver === "bunny" && process.env.BUNNY_STORAGE_API_KEY) {
    // Production/Staging: Bunny Storage API
    const storageZone = process.env.BUNNY_STORAGE_ZONE || "orochia-media";
    const regionHost = process.env.BUNNY_STORAGE_ENDPOINT || "storage.bunnycdn.com";
    const remotePath = `${category}/${sanitizedName}`;
    const bunnyUrl = `https://${regionHost}/${storageZone}/${remotePath}`;

    const res = await fetch(bunnyUrl, {
      method: "PUT",
      headers: {
        AccessKey: process.env.BUNNY_STORAGE_API_KEY,
        "Content-Type": "application/octet-stream",
      },
      body: new Uint8Array(fileBuffer),
    });

    if (!res.ok) {
      throw new Error(`Bunny storage upload failed: ${res.statusText}`);
    }

    const cdnHostname = process.env.BUNNY_PULL_ZONE_HOSTNAME || `${storageZone}.b-cdn.net`;
    return {
      url: `https://${cdnHostname}/${remotePath}`,
      driver: "bunny",
      filename: sanitizedName,
      sizeBytes: fileBuffer.length,
      mimeType: getMimeType(ext),
    };
  }

  // Local DevX Mode: write to public/uploads
  const uploadsDir = path.join(process.cwd(), "public", "uploads", category);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filePath = path.join(uploadsDir, sanitizedName);
  await fs.promises.writeFile(filePath, fileBuffer);

  return {
    url: `/uploads/${category}/${sanitizedName}`,
    driver: "local",
    filename: sanitizedName,
    sizeBytes: fileBuffer.length,
    mimeType: getMimeType(ext),
  };
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}
