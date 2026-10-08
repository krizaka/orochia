"use client";

import * as tus from "tus-js-client";
import type { VideoEdit } from "./video-edit-settings";

/**
 * Editor drafts, from the browser: the original clip is sent once to Bunny (Tus, like any video), the settings
 * and the form are saved by the API, the music beside them — so a draft opens again on any device. A copy of
 * the clip stays in this browser (IndexedDB) to reopen it without downloading it again.
 */

export type DraftKind = "video" | "story";
type Details = Record<string, string | number | boolean | string[] | null>;

export interface DraftSummary {
  id: string;
  kind: "VIDEO" | "STORY";
  status: "PENDING_UPLOAD" | "PROCESSING" | "READY" | "FAILED";
  fileName: string;
  contentType: string;
  sizeBytes: number;
  edit: Omit<VideoEdit, "music">;
  details: Details;
  musicName: string | null;
  hasMusic: boolean;
  thumbnailUrl: string | null;
  originalUrl: string | null;
  expiresAt: string;
  updatedAt: string;
}

export interface OpenedDraft {
  id: string;
  file: File;
  edit: VideoEdit;
  details: Details;
}

interface TusSession {
  tusEndpoint: string;
  headers: { AuthorizationSignature: string; AuthorizationExpire: number; VideoId: string; LibraryId: string };
}

const KIND = { video: "VIDEO", story: "STORY" } as const;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// ── Local copy of the clips (IndexedDB) ─────────────────────────────────────────────────────────
const DB = "orochia-drafts";
const STORE = "clips";

function openCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (db.objectStoreNames.contains("drafts")) db.deleteObjectStore("drafts");
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function cache<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  try {
    const db = await openCache();
    try {
      return await new Promise<T>((resolve, reject) => {
        const request = action(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  } catch {
    // Private browsing, storage full or blocked: the server copy is enough.
    return undefined;
  }
}

// ── API ─────────────────────────────────────────────────────────────────────────────────────────

export async function listDrafts(kind: DraftKind): Promise<DraftSummary[]> {
  return (await api<{ drafts: DraftSummary[] }>(`/api/me/drafts?kind=${KIND[kind]}`)).drafts;
}

function sendOriginal(file: File, session: TusSession, onProgress?: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    new tus.Upload(file, {
      endpoint: session.tusEndpoint,
      retryDelays: [0, 3000, 5000, 10000],
      headers: {
        AuthorizationSignature: session.headers.AuthorizationSignature,
        AuthorizationExpire: String(session.headers.AuthorizationExpire),
        VideoId: session.headers.VideoId,
        LibraryId: String(session.headers.LibraryId),
      },
      metadata: { filetype: file.type, title: "draft" },
      onProgress: (sent, total) => onProgress?.(Math.round((sent / total) * 100)),
      onError: reject,
      onSuccess: () => resolve(),
    }).start();
  });
}

/**
 * Saves an edit as a draft and returns its id. A new draft sends the original clip (progress 0–100); saving
 * an existing one only updates its settings and form. `musicChanged` re-sends or removes the music.
 */
export async function saveDraft(
  input: { kind: DraftKind; file: File; edit: VideoEdit; details?: Details; draftId?: string; musicChanged: boolean },
  onProgress?: (percent: number) => void,
): Promise<string> {
  const { music, ...edit } = input.edit;
  let id = input.draftId;
  if (id) {
    await api(`/api/me/drafts/${id}`, json("PATCH", { edit, details: input.details }));
  } else {
    const created = await api<{ draft: { id: string }; session: TusSession }>(
      "/api/me/drafts",
      json("POST", { kind: KIND[input.kind], fileName: input.file.name, contentType: input.file.type || "video/mp4", sizeBytes: input.file.size, edit, details: input.details ?? {} }),
    );
    id = created.draft.id;
    try {
      await sendOriginal(input.file, created.session, onProgress);
    } catch (error) {
      await fetch(`/api/me/drafts/${id}`, { method: "DELETE" }).catch(() => undefined);
      throw error;
    }
    await api(`/api/me/drafts/${id}/uploaded`, { method: "POST" });
    const clipId = id;
    await cache("readwrite", (store) => store.put(input.file, clipId));
  }
  if (input.musicChanged || (!input.draftId && music)) {
    if (music) {
      const form = new FormData();
      form.append("file", music);
      await api(`/api/me/drafts/${id}/music`, { method: "PUT", body: form });
    } else if (input.draftId) {
      await api(`/api/me/drafts/${id}/music`, { method: "DELETE" });
    }
  }
  return id;
}

/** Reads a download with progress (the original clip can be hundreds of MB). */
async function download(url: string, onProgress?: (percent: number) => void): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
  const total = Number(res.headers.get("Content-Length")) || 0;
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    received += value.length;
    if (total) onProgress?.(Math.round((received / total) * 100));
  }
  return new Blob(parts as BlobPart[]);
}

/** Opens a draft for the editor: the clip from this browser when it has it, from Bunny otherwise; and its music. */
export async function openDraft(draft: DraftSummary, onProgress?: (percent: number) => void): Promise<OpenedDraft> {
  let blob = await cache<Blob>("readonly", (store) => store.get(draft.id));
  if (!blob) {
    if (!draft.originalUrl) throw new Error("This draft is still being saved. Try again in a moment.");
    blob = await download(draft.originalUrl, onProgress);
    const fetched = blob;
    await cache("readwrite", (store) => store.put(fetched, draft.id));
  }
  const file = new File([blob], draft.fileName, { type: draft.contentType });
  let music: File | null = null;
  if (draft.hasMusic) {
    const res = await fetch(`/api/me/drafts/${draft.id}/music`, { cache: "no-store" });
    if (res.ok) music = new File([await res.blob()], draft.musicName ?? "music", { type: res.headers.get("Content-Type") ?? "audio/mpeg" });
  }
  return { id: draft.id, file, edit: { ...draft.edit, music }, details: draft.details };
}

/** Deletes a draft (with its clip and music), here and on the server. */
export async function deleteDraft(id: string): Promise<void> {
  await cache("readwrite", (store) => store.delete(id));
  await api(`/api/me/drafts/${id}`, { method: "DELETE" });
}
