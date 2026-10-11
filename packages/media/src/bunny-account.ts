/**
 * Bunny's account API (https://api.bunny.net, `AccessKey` = the ACCOUNT API key, not a library or zone key): the
 * totals Bunny bills on. Optional — the reconciliation works from the Stream API alone; with
 * `BUNNY_ACCOUNT_API_KEY` it also records the library's and the storage zone's own totals.
 *
 * - `GET /videolibrary/{id}` → `StorageUsage` (bytes, the whole library), `TrafficUsage`, `VideoCount`;
 * - `GET /storagezone/{id}` → `StorageUsed` (bytes), `FilesStored` — for the media zone (avatars, covers, story
 *   images, 2257 documents, drafts' music, backups, e-mail templates). Bunny refreshes these figures periodically
 *   (not in real time), which is fine for a daily reconciliation.
 */
export interface BunnyLibraryTotals {
  storageBytes: number | null;
  trafficBytes: number | null;
  videoCount: number | null;
}

export interface BunnyZoneTotals {
  storageBytes: number | null;
  files: number | null;
}

const API = "https://api.bunny.net";
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

async function get(path: string, accountKey: string, fetchImpl: typeof fetch): Promise<Record<string, unknown>> {
  const res = await fetchImpl(`${API}${path}`, { headers: { AccessKey: accountKey, Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Bunny account API ${path} answered ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

export async function getLibraryTotals(libraryId: number, accountKey: string, fetchImpl: typeof fetch = fetch): Promise<BunnyLibraryTotals> {
  const body = await get(`/videolibrary/${libraryId}`, accountKey, fetchImpl);
  return { storageBytes: num(body.StorageUsage), trafficBytes: num(body.TrafficUsage), videoCount: num(body.VideoCount) };
}

/** A storage zone by id, or by name (searched) when no id is known. */
export async function getStorageZoneTotals(zone: { id?: string | number | null; name?: string | null }, accountKey: string, fetchImpl: typeof fetch = fetch): Promise<BunnyZoneTotals | null> {
  let body: Record<string, unknown> | undefined;
  if (zone.id) body = await get(`/storagezone/${zone.id}`, accountKey, fetchImpl);
  else if (zone.name) {
    const list = await get(`/storagezone?page=1&perPage=1000&search=${encodeURIComponent(zone.name)}`, accountKey, fetchImpl);
    const items = (Array.isArray(list) ? list : (list.Items as unknown[]) ?? []) as Record<string, unknown>[];
    body = items.find((z) => z.Name === zone.name);
  }
  return body ? { storageBytes: num(body.StorageUsed), files: num(body.FilesStored) } : null;
}
