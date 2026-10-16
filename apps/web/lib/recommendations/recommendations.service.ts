import type { ExploreVideo, ExploreViewer } from "../explore";
import type { CallResult } from "../orazaka";
import { type Feed, type Pseudonym, type RecommendationSettings, type RecoReason, ShelfSource } from "./recommendations.types";

/**
 * The shelves that ask Orazaka (ADR-078): "For you" and "More like this". Orazaka ranks; Orochia decides what may be
 * shown — every id it answers goes through Orochia's discovery query again (`byIds`), and whatever Orazaka cannot give
 * (off, slow, down, too few) is completed by Orochia's own answer (trending, tags). A shelf is never empty for want of AI.
 * Dependencies are injected: this file holds the rules, not the I/O.
 */
export interface Shelf {
  videos: (ExploreVideo & { reasons?: RecoReason[] })[];
  source: ShelfSource;
  /** Orazaka's request id (its log line), when it answered. */
  requestId: string | null;
}

export interface ShelfDeps {
  settings: () => Promise<RecommendationSettings | null>;
  pseudonym: (accountId: string) => Pseudonym | null;
  forYou: (user: Pseudonym, limit: number, exclude: string[], timeoutMs: number) => Promise<CallResult<Feed>>;
  similar: (item: string, limit: number, timeoutMs: number) => Promise<CallResult<Feed>>;
  byIds: (ids: string[], viewer: ExploreViewer | null) => Promise<ExploreVideo[]>;
  fallbackForYou: (viewer: ExploreViewer | null, limit: number) => Promise<ExploreVideo[]>;
  fallbackSimilar: (videoId: string, viewer: ExploreViewer | null, limit: number) => Promise<ExploreVideo[]>;
}

/** Orazaka's order, filtered by Orochia's rules, completed by the fallback up to `limit` (no duplicate). */
async function assemble(feed: Feed, limit: number, viewer: ExploreViewer | null, deps: ShelfDeps, fill: () => Promise<ExploreVideo[]>, exclude: string[] = []) {
  const reasons = new Map(feed.items.map((i) => [i.id, i.reasons]));
  const shown = (await deps.byIds(feed.items.map((i) => i.id), viewer)).map((v) => ({ ...v, reasons: reasons.get(v.id) }));
  if (shown.length >= limit) return shown.slice(0, limit);
  const seen = new Set([...shown.map((v) => v.id), ...exclude]);
  const extra = (await fill()).filter((v) => !seen.has(v.id));
  return [...shown, ...extra].slice(0, limit);
}

/** "For you": the signed-in viewer's feed from Orazaka, or trending. */
export async function forYouShelf(viewer: ExploreViewer | null, deps: ShelfDeps): Promise<Shelf> {
  const settings = await deps.settings();
  const limit = settings?.forYouLimit ?? 12;
  const fallback = async (): Promise<Shelf> => ({ videos: await deps.fallbackForYou(viewer, limit), source: ShelfSource.Fallback, requestId: null });
  const user = viewer ? deps.pseudonym(viewer.id) : null;
  if (!settings?.enabled || !viewer || !user) return fallback();
  try {
    const answer = await deps.forYou(user, limit, [], settings.timeoutMs);
    if (answer.data.items.length === 0) return fallback();
    const videos = await assemble(answer.data, limit, viewer, deps, () => deps.fallbackForYou(viewer, limit));
    return { videos, source: ShelfSource.Orazaka, requestId: answer.requestId ?? answer.data.requestId };
  } catch {
    return fallback();
  }
}

/** "More like this" on a video's page: Orazaka's neighbours, or Orochia's (meaning, then tags). */
export async function similarShelf(videoId: string, viewer: ExploreViewer | null, deps: ShelfDeps): Promise<Shelf> {
  const settings = await deps.settings();
  const limit = settings?.similarLimit ?? 4;
  const fallback = async (): Promise<Shelf> => ({ videos: await deps.fallbackSimilar(videoId, viewer, limit), source: ShelfSource.Fallback, requestId: null });
  if (!settings?.enabled) return fallback();
  try {
    const answer = await deps.similar(videoId, limit, settings.timeoutMs);
    if (answer.data.items.length === 0) return fallback();
    const videos = await assemble(answer.data, limit, viewer, deps, () => deps.fallbackSimilar(videoId, viewer, limit), [videoId]);
    return { videos, source: ShelfSource.Orazaka, requestId: answer.requestId ?? answer.data.requestId };
  } catch {
    return fallback();
  }
}
