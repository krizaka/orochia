import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Story lifecycle without a database: a scripted `db` answers the queries of lib/stories.ts in order
 * (selects from a queue, updates recorded), and a fake Bunny client answers the Stream API.
 */
const selects: unknown[][] = [];
const updates: { set?: Record<string, unknown>; returning?: boolean }[] = [];
let claimRows: { id: string }[] = [{ id: "story-1" }];

function chain(resolve: () => unknown) {
  const c: object = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then") return (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve().then(resolve).then(ok, ko);
        return () => c;
      },
    },
  );
  return c;
}

const fakeDb = {
  select: () => chain(() => selects.shift() ?? []),
  update: () => {
    const record: { set?: Record<string, unknown>; returning?: boolean } = {};
    updates.push(record);
    const c: object = new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === "then") return (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(record.returning ? claimRows : undefined).then(ok, ko);
          if (prop === "set")
            return (v: Record<string, unknown>) => {
              record.set = v;
              return c;
            };
          if (prop === "returning")
            return () => {
              record.returning = true;
              return c;
            };
          return () => c;
        },
      },
    );
    return c;
  },
};

vi.mock("@orochia/db", async (original) => ({ ...(await original<typeof import("@orochia/db")>()), db: fakeDb }));

const { BunnyApiError, mapBunnyApiStatusToOrochia } = await import("@orochia/media");
const { reconcileDecision, reconcileStoryVideos, settleStoryVideo, storyForViewerAction, storyInsights, storyState, STORY_UPLOAD_WINDOW_MS, updateStoryAudience } = await import("./stories");

const GUID = "9858b4b7-1d10-4ed0-83b1-1f31f527ccbe";
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);
const pending = (status: "PENDING_UPLOAD" | "PROCESSING" = "PENDING_UPLOAD", createdAt = minutesAgo(10)) => ({ id: "story-1", bunnyVideoId: GUID, status, createdAt, updatedAt: createdAt });
const storyRow = (status: string) => ({ id: "story-1", bunnyVideoId: GUID, status });

function bunny(answer: { status: number; length: number } | Error) {
  return {
    getVideo: vi.fn(async () => {
      if (answer instanceof Error) throw answer;
      return { ...answer, guid: GUID } as never;
    }),
    deleteVideo: vi.fn(async () => true),
  };
}

beforeEach(() => {
  selects.length = 0;
  updates.length = 0;
  claimRows = [{ id: "story-1" }];
  process.env.BUNNY_STREAM_API_KEY = "test-key";
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("Bunny API states (not the webhook's numbering)", () => {
  it("maps the Stream API status of a video", () => {
    expect(mapBunnyApiStatusToOrochia(0)).toBeNull();
    for (const s of [1, 2, 3, 7, 8]) expect(mapBunnyApiStatusToOrochia(s)).toBe("PROCESSING");
    expect(mapBunnyApiStatusToOrochia(4)).toBe("READY");
    expect(mapBunnyApiStatusToOrochia(5)).toBe("FAILED");
    expect(mapBunnyApiStatusToOrochia(6)).toBe("FAILED");
  });

  it("tells the rail where a story stands", () => {
    expect(storyState("READY")).toBe("ready");
    expect(storyState("PENDING_UPLOAD")).toBe("processing");
    expect(storyState("PROCESSING")).toBe("processing");
    expect(storyState("FAILED")).toBe("failed");
  });
});

describe("reconcileDecision", () => {
  it("settles what Bunny finished, failed or lost", () => {
    expect(reconcileDecision(pending(), { status: 4 })).toBe("READY");
    expect(reconcileDecision(pending(), { status: 5 })).toBe("FAILED");
    expect(reconcileDecision(pending(), { missing: true })).toBe("FAILED");
    expect(reconcileDecision(pending(), { status: 3 })).toBe("PROCESSING");
  });

  it("changes nothing that is already known", () => {
    expect(reconcileDecision(pending("PROCESSING"), { status: 2 })).toBeNull();
  });

  it("waits for the bytes during the upload window, then gives up", () => {
    expect(reconcileDecision(pending(), { status: 0 })).toBeNull();
    const old = new Date(Date.now() - STORY_UPLOAD_WINDOW_MS - 60_000);
    expect(reconcileDecision(pending("PENDING_UPLOAD", old), { status: 0 })).toBe("FAILED");
  });
});

describe("reconcileStoryVideos — the webhook never came", () => {
  it("makes a story Bunny finished READY, with its length and a fresh 24 hours", async () => {
    selects.push([pending()], [storyRow("PENDING_UPLOAD")]);
    const client = bunny({ status: 4, length: 8 });
    await expect(reconcileStoryVideos({ client })).resolves.toEqual({ checked: 1, settled: 1 });
    const applied = updates.at(-1)!.set!;
    expect(applied.status).toBe("READY");
    expect(applied.durationSeconds).toBe(8);
    expect((applied.expiresAt as Date).getTime()).toBeGreaterThan(Date.now() + 23.9 * 3600_000);
    expect(client.deleteVideo).not.toHaveBeenCalled();
  });

  it("refuses and deletes a finished video longer than a story", async () => {
    selects.push([pending()], [storyRow("PROCESSING")]);
    const client = bunny({ status: 4, length: 300 });
    await reconcileStoryVideos({ client });
    expect(updates.at(-1)!.set!.status).toBe("FAILED");
    expect(client.deleteVideo).toHaveBeenCalledWith(GUID);
  });

  it("fails a story whose video is gone at Bunny", async () => {
    selects.push([pending()], [storyRow("PENDING_UPLOAD")]);
    await reconcileStoryVideos({ client: bunny(new BunnyApiError(404, "not found")) });
    expect(updates.at(-1)!.set!.status).toBe("FAILED");
  });

  it("leaves the story for the next pass when Bunny is unreachable", async () => {
    selects.push([pending()]);
    await expect(reconcileStoryVideos({ client: bunny(new BunnyApiError(503, "down")) })).resolves.toEqual({ checked: 1, settled: 0 });
    expect(updates).toHaveLength(1); // the claim only
  });

  it("never asks twice: a story claimed by another request is skipped", async () => {
    selects.push([pending()]);
    claimRows = [];
    const client = bunny({ status: 4, length: 8 });
    await reconcileStoryVideos({ client });
    expect(client.getVideo).not.toHaveBeenCalled();
  });

  it("does nothing without a Bunny library (CI, local without video)", async () => {
    delete process.env.BUNNY_STREAM_API_KEY;
    const client = bunny({ status: 4, length: 8 });
    await expect(reconcileStoryVideos({ client })).resolves.toEqual({ checked: 0, settled: 0 });
    expect(client.getVideo).not.toHaveBeenCalled();
  });
});

describe("settleStoryVideo — shared with the webhook", () => {
  it("ignores a repeated or late event", async () => {
    selects.push([storyRow("READY")]);
    await expect(settleStoryVideo(GUID, "READY", bunny({ status: 4, length: 8 }), 8)).resolves.toMatchObject({ storyId: "story-1" });
    selects.push([storyRow("READY")]);
    await settleStoryVideo(GUID, "PROCESSING", bunny({ status: 4, length: 8 }));
    expect(updates).toHaveLength(0);
  });

  it("answers null for a video that is no story (a draft, an unknown upload)", async () => {
    selects.push([]);
    await expect(settleStoryVideo(GUID, "PROCESSING", bunny({ status: 2, length: 0 }))).resolves.toBeNull();
  });
});

describe("story actions", () => {
  const live = (over: Record<string, unknown> = {}) => ({
    id: "story-1",
    creatorId: "creator",
    visibility: "PUBLIC",
    audienceListId: null,
    status: "READY",
    expiresAt: new Date(Date.now() + 3600_000),
    ...over,
  });

  it("a viewer tips, answers or reports a live story they may see — never their own", async () => {
    selects.push([live()]);
    await expect(storyForViewerAction("story-1", "viewer")).resolves.toMatchObject({ creatorId: "creator" });
    selects.push([live()]);
    await expect(storyForViewerAction("story-1", "creator")).rejects.toMatchObject({ status: 400 });
  });

  it("an expired, unfinished or unknown story does not exist for actions (404)", async () => {
    selects.push([live({ expiresAt: new Date(Date.now() - 1000) })]);
    await expect(storyForViewerAction("story-1", "viewer")).rejects.toMatchObject({ status: 404 });
    selects.push([live({ status: "PROCESSING" })]);
    await expect(storyForViewerAction("story-1", "viewer")).rejects.toMatchObject({ status: 404 });
    selects.push([]);
    await expect(storyForViewerAction("story-1", "viewer")).rejects.toMatchObject({ status: 404 });
  });

  it("a story's audience changes for its author; one delivered for a challenge keeps its backers", async () => {
    selects.push([{ id: "story-1", visibility: "PUBLIC" }]);
    await expect(updateStoryAudience("story-1", "creator", "CONTACTS_ONLY")).resolves.toEqual({ audience: "CONTACTS_ONLY", audienceListId: null });
    expect(updates.at(-1)?.set).toMatchObject({ visibility: "CONTACTS_ONLY", audienceListId: null });
    selects.push([{ id: "story-1", visibility: "CHALLENGE" }]);
    await expect(updateStoryAudience("story-1", "creator", "PUBLIC")).rejects.toMatchObject({ status: 409 });
    // Someone else's story (the query is scoped to the author): 404.
    selects.push([]);
    await expect(updateStoryAudience("story-1", "intruder", "PUBLIC")).rejects.toMatchObject({ status: 404 });
  });

  it("close friends needs one of the author's lists", async () => {
    selects.push([{ id: "story-1", visibility: "PUBLIC" }]);
    await expect(updateStoryAudience("story-1", "creator", "INVITED_ONLY", null)).rejects.toMatchObject({ status: 400 });
  });

  it("insights answer the author only, and name accounts but only count visitors", async () => {
    selects.push([]);
    await expect(storyInsights("story-1", "intruder")).rejects.toMatchObject({ status: 404 });
    selects.push(
      [{ id: "story-1", viewsCount: 5, likesCount: 1, tipsCount: 1 }],
      [{ username: "alex", displayName: "Alex", avatarUrl: null, viewedAt: new Date(), userId: "u-alex" }],
      [{ userId: "u-alex" }],
      [{ username: "alex", displayName: "Alex", avatarUrl: null, amountCents: 500, at: new Date() }],
      [{ n: 1 }],
    );
    const insights = await storyInsights("story-1", "creator");
    expect(insights.guestViews).toBe(4);
    expect(insights.viewers[0]).toMatchObject({ username: "alex", liked: true });
    expect(insights.tipsTotalCents).toBe(500);
  });
});
