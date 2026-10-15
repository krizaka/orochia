import { type ExploreQuery, type ExploreResults, exploreResults, type ExploreVideo, type ExploreViewer, RESULTS_PAGE, similarByTags, videosByIds } from "./explore";
import { fuseRankings } from "./explorer";
import { nearestVideoIds, queryVector, relatedVideoIds, type SemanticStatus } from "./explorer-index";

/**
 * Explore's search with the Explorer on top: the full-text search stays what it is (lib/explore.ts); on the first page of
 * a plain search, the videos whose *meaning* is near the query (Orazaka's embedding, pgvector) are merged in by reciprocal
 * rank fusion — a video found by its words and its meaning rises, one found only by meaning is added. Whatever goes wrong
 * — Orazaka not configured, paused, down, throttled, the index empty, the vector query failing — the answer is exactly the
 * full-text answer, and `meaning.status` says why (the operator's view reads it; visitors see no error).
 */

export interface MeaningResults extends ExploreResults {
  meaning: { status: SemanticStatus; /** Videos found by meaning (alone or with their words). */ found: number };
}

export interface MeaningDeps {
  base: (viewer: ExploreViewer | null, query: ExploreQuery) => Promise<ExploreResults>;
  vector: typeof queryVector;
  nearest: typeof nearestVideoIds;
  byIds: (ids: string[], viewer: ExploreViewer | null) => Promise<ExploreVideo[]>;
}

const defaults: MeaningDeps = { base: exploreResults, vector: queryVector, nearest: nearestVideoIds, byIds: videosByIds };

export async function exploreResultsByMeaning(viewer: ExploreViewer | null, query: ExploreQuery, deps: MeaningDeps = defaults): Promise<MeaningResults> {
  const base = await deps.base(viewer, query);
  const term = query.q?.trim() ?? "";
  // A tag is an exact filter and later pages continue the text ranking: meaning only widens the first page of a plain search.
  if (!term || query.tag || (query.page ?? 1) > 1) return { ...base, meaning: { status: "off", found: 0 } };

  try {
    const vector = await deps.vector(term);
    if (vector.status !== "ok" || !("vector" in vector)) return { ...base, meaning: { status: vector.status === "ok" ? "off" : vector.status, found: 0 } };
    const nearIds = await deps.nearest(vector.vector, vector.model);
    if (nearIds.length === 0) return { ...base, meaning: { status: "ok", found: 0 } };

    const textIds = base.videos.map((v) => v.id);
    const fused = fuseRankings(textIds, nearIds).slice(0, RESULTS_PAGE);
    const have = new Map(base.videos.map((v) => [v.id, v]));
    const missing = fused.map((f) => f.id).filter((id) => !have.has(id));
    for (const video of await deps.byIds(missing, viewer)) have.set(video.id, video);
    const videos = fused.flatMap((f) => {
      const video = have.get(f.id);
      return video ? [{ ...video, via: f.via }] : [];
    });
    return { ...base, videos, meaning: { status: "ok", found: videos.filter((v) => v.via !== "text").length } };
  } catch (error) {
    console.error("[explorer] meaning search failed — full-text answer kept", error);
    return { ...base, meaning: { status: "unavailable", found: 0 } };
  }
}

export interface SimilarDeps {
  related: typeof relatedVideoIds;
  byIds: (ids: string[], viewer: ExploreViewer | null) => Promise<ExploreVideo[]>;
  byTags: (videoId: string, viewer: ExploreViewer | null, limit: number) => Promise<ExploreVideo[]>;
}

const similarDefaults: SimilarDeps = { related: relatedVideoIds, byIds: videosByIds, byTags: similarByTags };

/**
 * "More like this" on a video's page: the videos nearest to its stored meaning (no call to Orazaka at read time); when the
 * video has no vector yet, or the vector query fails, the videos sharing its tags — the non-AI answer, never an empty
 * block for want of AI.
 */
export async function similarVideos(videoId: string, viewer: ExploreViewer | null, limit = 4, deps: SimilarDeps = similarDefaults): Promise<ExploreVideo[]> {
  try {
    const ids = await deps.related(videoId, limit);
    if (ids.length > 0) {
      const videos = await deps.byIds(ids, viewer);
      if (videos.length > 0) return videos.map((v) => ({ ...v, via: "meaning" as const }));
    }
  } catch (error) {
    console.error("[explorer] related videos by meaning failed — tags kept", error);
  }
  return deps.byTags(videoId, viewer, limit);
}
