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
 * through /api/admin/documents; the music of editor drafts (`private/audio/`) is read only by its owner.
 * The storage pull zone must not serve `/private/*` (edge rule).
 */
const PRIVATE: ReadonlySet<string> = new Set(["documents", "audio"]);
const LOCAL_PRIVATE_DIR = path.join(process.cwd(), ".private-uploads");
export async function uploadMediaFile(
  fileBuffer: Buffer,
  originalFilename: string,
  category: "avatars" | "banners" | "thumbnails" | "stories" | "videos" | "documents" | "audio" = "videos"
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

const PRIVATE_REF = /^private\/(documents|audio)\/([0-9a-f-]{36}\.(?:pdf|jpg|png|mp3|m4a|aac|wav|ogg))$/;

/** A private file by reference (`private/documents/<uuid>.<ext>`), or null when it does not exist. */
export async function readPrivateFile(ref: string): Promise<{ body: Buffer; mimeType: string } | null> {
  const match = PRIVATE_REF.exec(ref);
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

/** Removes a private file (a draft's music); a missing file is not an error. */
export async function deletePrivateFile(ref: string): Promise<void> {
  const match = PRIVATE_REF.exec(ref);
  if (!match) return;
  if (process.env.STORAGE_DRIVER === "bunny" && process.env.BUNNY_STORAGE_API_KEY) {
    const storageZone = process.env.BUNNY_STORAGE_ZONE || "orochia-media";
    const regionHost = process.env.BUNNY_STORAGE_ENDPOINT || "storage.bunnycdn.com";
    const res = await fetch(`https://${regionHost}/${storageZone}/${ref}`, { method: "DELETE", headers: { AccessKey: process.env.BUNNY_STORAGE_API_KEY } });
    if (!res.ok && res.status !== 404) throw new Error(`Bunny storage delete failed: ${res.status}`);
    return;
  }
  await fs.promises.rm(path.join(LOCAL_PRIVATE_DIR, match[1], match[2]), { force: true });
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
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}

// ── Private objects by key (operator files: database backups) ─────────────────────────────────

/** The Bunny Edge Storage zone (`BUNNY_STORAGE_*`), whatever STORAGE_DRIVER says — null without an access key. */
export function bunnyStorageCredentials(env: NodeJS.ProcessEnv = process.env): { base: string; key: string } | null {
  if (!env.BUNNY_STORAGE_API_KEY) return null;
  const storageZone = env.BUNNY_STORAGE_ZONE || "orochia-media";
  const regionHost = env.BUNNY_STORAGE_ENDPOINT || "storage.bunnycdn.com";
  return { base: `https://${regionHost}/${storageZone}`, key: env.BUNNY_STORAGE_API_KEY };
}

function bunnyStorage(): { base: string; key: string } | null {
  return process.env.STORAGE_DRIVER === "bunny" ? bunnyStorageCredentials() : null;
}

const PRIVATE_KEY = /^private\/[a-z]+\/[A-Za-z0-9._-]+$/;
function checkKey(key: string) {
  if (!PRIVATE_KEY.test(key) || key.includes("..")) throw new Error(`invalid private key ${key}`);
}

/** Writes a private object (never publicly served); in production on Bunny Edge Storage only. */
export async function putPrivateObject(key: string, body: Buffer): Promise<void> {
  checkKey(key);
  const bunny = bunnyStorage();
  if (!bunny && process.env.NODE_ENV === "production") throw new ConfigurationError("STORAGE_DRIVER=bunny and BUNNY_STORAGE_API_KEY");
  if (bunny) {
    const res = await fetch(`${bunny.base}/${key}`, { method: "PUT", headers: { AccessKey: bunny.key, "Content-Type": "application/octet-stream" }, body: new Uint8Array(body) });
    if (!res.ok) throw new Error(`Bunny storage upload failed: ${res.status}`);
    return;
  }
  const file = path.join(LOCAL_PRIVATE_DIR, key.slice("private/".length));
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  await fs.promises.writeFile(file, body);
}

/** Reads a private object, or null when it does not exist. */
export async function getPrivateObject(key: string): Promise<Buffer | null> {
  checkKey(key);
  const bunny = bunnyStorage();
  if (bunny) {
    const res = await fetch(`${bunny.base}/${key}`, { headers: { AccessKey: bunny.key } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Bunny storage read failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  const file = path.join(LOCAL_PRIVATE_DIR, key.slice("private/".length));
  return fs.existsSync(file) ? fs.promises.readFile(file) : null;
}

/** Lists the private objects of a folder (`private/backups`). */
export async function listPrivateObjects(folder: string): Promise<{ name: string; sizeBytes: number; createdAt: string }[]> {
  checkKey(`${folder}/x`);
  const bunny = bunnyStorage();
  if (bunny) {
    const res = await fetch(`${bunny.base}/${folder}/`, { headers: { AccessKey: bunny.key, Accept: "application/json" } });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`Bunny storage list failed: ${res.status}`);
    const items = (await res.json()) as { ObjectName: string; Length: number; DateCreated: string; IsDirectory: boolean }[];
    return items.filter((i) => !i.IsDirectory).map((i) => ({ name: i.ObjectName, sizeBytes: i.Length, createdAt: new Date(`${i.DateCreated}Z`).toISOString() }));
  }
  const dir = path.join(LOCAL_PRIVATE_DIR, folder.slice("private/".length));
  if (!fs.existsSync(dir)) return [];
  const names = await fs.promises.readdir(dir);
  return Promise.all(
    names.map(async (name) => {
      const stat = await fs.promises.stat(path.join(dir, name));
      return { name, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
    }),
  );
}

/** Removes a private object; a missing one is not an error. */
export async function deletePrivateObject(key: string): Promise<void> {
  checkKey(key);
  const bunny = bunnyStorage();
  if (bunny) {
    const res = await fetch(`${bunny.base}/${key}`, { method: "DELETE", headers: { AccessKey: bunny.key } });
    if (!res.ok && res.status !== 404) throw new Error(`Bunny storage delete failed: ${res.status}`);
    return;
  }
  await fs.promises.rm(path.join(LOCAL_PRIVATE_DIR, key.slice("private/".length)), { force: true });
}

// ── Configuration objects by key (mail templates: `mail-templates/…`) ─────────────────────────

const CONFIG_KEY = /^mail-templates\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.(?:html|txt|json)$/;
function checkConfigKey(key: string) {
  if (!CONFIG_KEY.test(key) || key.includes("..")) throw new Error(`invalid configuration key ${key}`);
}

/**
 * Reads a configuration object from the Bunny Edge Storage zone, or null when it does not exist. Throws when the zone
 * is not configured, refuses the request or cannot be reached (callers decide how to fall back).
 */
export async function getBunnyConfigObject(key: string, options: { env?: NodeJS.ProcessEnv; timeoutMs?: number } = {}): Promise<string | null> {
  checkConfigKey(key);
  const bunny = bunnyStorageCredentials(options.env);
  if (!bunny) throw new ConfigurationError("BUNNY_STORAGE_API_KEY", "is required to read from Bunny Storage");
  const res = await fetch(`${bunny.base}/${key}`, { headers: { AccessKey: bunny.key }, signal: AbortSignal.timeout(options.timeoutMs ?? 3000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Bunny storage read failed: ${res.status}`);
  return res.text();
}

/** Writes a configuration object to the Bunny Edge Storage zone (UTF-8 text). */
export async function putBunnyConfigObject(key: string, body: string, options: { env?: NodeJS.ProcessEnv } = {}): Promise<void> {
  checkConfigKey(key);
  const bunny = bunnyStorageCredentials(options.env);
  if (!bunny) throw new ConfigurationError("BUNNY_STORAGE_API_KEY", "is required to write to Bunny Storage");
  const contentType = key.endsWith(".html") ? "text/html; charset=utf-8" : key.endsWith(".json") ? "application/json" : "text/plain; charset=utf-8";
  const res = await fetch(`${bunny.base}/${key}`, { method: "PUT", headers: { AccessKey: bunny.key, "Content-Type": contentType }, body });
  if (!res.ok) throw new Error(`Bunny storage upload failed: ${res.status}`);
}
