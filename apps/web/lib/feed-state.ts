/**
 * The pages of each home feed tab, as one reducer (pure, tested): what is shown, where the next page starts, and whether a
 * page is on its way or failed. A tab is `loaded` once its first page arrived (the server renders the open tab; the others
 * ask for theirs when first opened).
 */

export const TabStatus = { Idle: "idle", Loading: "loading", Failed: "failed" } as const;
export type TabStatus = (typeof TabStatus)[keyof typeof TabStatus];

export type FeedTabId = "foryou" | "latest" | "trending" | "following";
export const FEED_TABS: readonly FeedTabId[] = ["foryou", "latest", "trending", "following"];

export interface TabState<T> {
  videos: T[];
  nextCursor: string | null;
  /** The first page is in. */
  loaded: boolean;
  status: TabStatus;
}
export type FeedStates<T> = Record<FeedTabId, TabState<T>>;

export interface PageData<T> {
  videos: T[];
  nextCursor: string | null;
}

export type FeedAction<T> = { type: "request"; tab: FeedTabId } | { type: "received"; tab: FeedTabId; page: PageData<T> } | { type: "failed"; tab: FeedTabId };

const empty = <T>(): TabState<T> => ({ videos: [], nextCursor: null, loaded: false, status: "idle" });

/** All tabs empty but `tab`, which starts from its server-rendered first page. */
export function feedStateOf<T>(tab: FeedTabId, first: PageData<T>): FeedStates<T> {
  return { foryou: empty(), latest: empty(), trending: empty(), following: empty(), [tab]: { videos: first.videos, nextCursor: first.nextCursor, loaded: true, status: "idle" } };
}

/** There is a page to ask for: the first of a tab never opened, or the one after the cursor. */
export const hasMore = <T>(tab: TabState<T>) => !tab.loaded || tab.nextCursor !== null;

export function feedReducer<T extends { id: string }>(state: FeedStates<T>, action: FeedAction<T>): FeedStates<T> {
  const tab = state[action.tab];
  switch (action.type) {
    case "request":
      return tab.status === TabStatus.Loading ? state : { ...state, [action.tab]: { ...tab, status: "loading" } };
    case "failed":
      return { ...state, [action.tab]: { ...tab, status: "failed" } };
    case "received": {
      const seen = new Set(tab.videos.map((v) => v.id));
      const fresh = action.page.videos.filter((v) => !seen.has(v.id));
      return { ...state, [action.tab]: { videos: [...tab.videos, ...fresh], nextCursor: action.page.nextCursor, loaded: true, status: "idle" } };
    }
  }
}
