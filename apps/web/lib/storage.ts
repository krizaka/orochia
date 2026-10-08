import { ConfigurationError } from "./env";
import crypto from "crypto";
import fs from "fs";
import path from "path";

export interface UploadResult {
  /** Public URL — null for private files (2257 documents), which are read through /api/admin/documents. */
  url: string | null;
  /** Storage reference, e.g. "private/documents/<uuid>.pdf". */
  ref: string;
  driver: "local" | "bunny";
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

/**
 * Dual-Mode Storage Service:
 * - Local filesystem folder storage for seamless DevX
 * - Bunny.net Edge Storage for staging and production
 *
 * Names are random UUIDs, never derived from the client. 2257 documents are private: stored under
 * `private/` (outside public/ locally), they get no public URL and are read only by operators
 * through /api/admin/documents. The storage pull zone must not serve `/private/*` (edge rule).
 */
const PRIVATE: ReadonlySet<string> = new Set(["documents"]);
const LOCAL_PRIVATE_DIR = path.join(process.cwd(), ".private-uploads");
export async function uploadMediaFile(
  fileBuffer: Buffer,
  originalFilename: string,
  category: "avatars" | "thumbnails" | "stories" | "videos" | "documents" = "videos"
): Promise<UploadResult> {
  const driver = process.env.STORAGE_DRIVER === "bunny" ? "bunny" : "local";
  // Container filesystems are ephemeral: production stores media on Bunny Edge Storage only.
  if (process.env.NODE_ENV === "production" && (driver !== "bunny" || !process.env.BUNNY_STORAGE_API_KEY)) {
    throw new ConfigurationError("STORAGE_DRIVER=bunny and BUNNY_STORAGE_API_KEY");
  }
  const ext = path.extname(originalFilename) || (category === "videos" ? ".mp4" : ".jpg");
  const sanitizedName = `${crypto.randomUUID()}${ext}`;
  const isPrivate = PRIVATE.has(category);
  const remotePath = `${isPrivate ? "private/" : ""}${category}/${sanitizedName}`;

  if (driver === "bunny" && process.env.BUNNY_STORAGE_API_KEY) {
    // Production/Staging: Bunny Storage API
    const storageZone = process.env.BUNNY_STORAGE_ZONE || "orochia-media";
    const regionHost = process.env.BUNNY_STORAGE_ENDPOINT || "storage.bunnycdn.com";
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
      url: isPrivate ? null : `https://${cdnHostname}/${remotePath}`,
      ref: remotePath,
      driver: "bunny",
      filename: sanitizedName,
      sizeBytes: fileBuffer.length,
      mimeType: getMimeType(ext),
    };
  }

  // Local DevX Mode: write to public/uploads
  const uploadsDir = isPrivate ? path.join(LOCAL_PRIVATE_DIR, category) : path.join(process.cwd(), "public", "uploads", category);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filePath = path.join(uploadsDir, sanitizedName);
  await fs.promises.writeFile(filePath, fileBuffer);

  return {
    url: isPrivate ? null : `/uploads/${category}/${sanitizedName}`,
    ref: remotePath,
    driver: "local",
    filename: sanitizedName,
    sizeBytes: fileBuffer.length,
    mimeType: getMimeType(ext),
  };
}

/** The public URL of a stored (non-private) file, from its reference — never from a client-supplied URL. */
export function publicUrlForRef(ref: string): string {
  if (process.env.STORAGE_DRIVER === "bunny" && process.env.BUNNY_STORAGE_API_KEY) {
    const storageZone = process.env.BUNNY_STORAGE_ZONE || "orochia-media";
    return `https://${process.env.BUNNY_PULL_ZONE_HOSTNAME || `${storageZone}.b-cdn.net`}/${ref}`;
  }
  return `/uploads/${ref}`;
}

/** A private file by reference (`private/documents/<uuid>.<ext>`), or null when it does not exist. */
export async function readPrivateFile(ref: string): Promise<{ body: Buffer; mimeType: string } | null> {
  const match = /^private\/(documents)\/([0-9a-f-]{36}\.(?:pdf|jpg|png))$/.exec(ref);
  if (!match) return null;
  const [, category, name] = match;
  const mimeType = getMimeType(path.extname(name));
  if (process.env.STORAGE_DRIVER === "bunny" && process.env.BUNNY_STORAGE_API_KEY) {
    const storageZone = process.env.BUNNY_STORAGE_ZONE || "orochia-media";
    const regionHost = process.env.BUNNY_STORAGE_ENDPOINT || "storage.bunnycdn.com";
    const res = await fetch(`https://${regionHost}/${storageZone}/${ref}`, { headers: { AccessKey: process.env.BUNNY_STORAGE_API_KEY } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Bunny storage read failed: ${res.status}`);
    return { body: Buffer.from(await res.arrayBuffer()), mimeType };
  }
  const file = path.join(LOCAL_PRIVATE_DIR, category, name);
  return fs.existsSync(file) ? { body: await fs.promises.readFile(file), mimeType } : null;
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
