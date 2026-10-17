import { pseudonymKey } from "../env";
import { type ExploreViewer, trendingVideos, videosByIds } from "../explore";
import { similarVideos } from "../explore-semantic";
import { fetchForYou, fetchSimilar } from "./recommendations.client";
import { pseudonymOf } from "./recommendations.pseudonym";
import { forYouShelf, type Shelf, type ShelfDeps, similarShelf } from "./recommendations.service";
import { recommendationSettings } from "./recommendations.settings";
import { ShelfSource } from "./recommendations.types";

/**
 * The shelves wired to the real world: Orazaka's client, Orochia's discovery query, trending and the Explorer's
 * neighbours as fallbacks. Each served shelf logs Orazaka's request id — the same id as its `recommendation.served`
 * line — so one look at both logs ties a page to its feed.
 */
function deps(now: Date): ShelfDeps {
  return {
    settings: () => recommendationSettings(now),
    pseudonym: (accountId) => {
      const key = pseudonymKey();
      return key ? pseudonymOf(accountId, key) : null;
    },
    forYou: fetchForYou,
    similar: fetchSimilar,
    byIds: videosByIds,
    fallbackForYou: (viewer, limit) => trendingVideos(viewer, limit, now),
    fallbackSimilar: (videoId, viewer, limit) => similarVideos(videoId, viewer, limit),
  };
}

function logged(kind: string, shelf: Shelf): Shelf {
  if (shelf.source === ShelfSource.Orazaka) console.log(`[recommendations] ${kind} served by Orazaka requestId=${shelf.requestId} videos=${shelf.videos.length}`);
  return shelf;
}

export async function forYou(viewer: ExploreViewer | null, now: Date): Promise<Shelf> {
  return logged("for-you", await forYouShelf(viewer, deps(now)));
}

export async function moreLikeThis(videoId: string, viewer: ExploreViewer | null, now: Date): Promise<Shelf> {
  return logged("similar", await similarShelf(videoId, viewer, deps(now)));
}
