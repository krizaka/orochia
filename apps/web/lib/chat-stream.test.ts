import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * lib/chat-stream.ts — an account's live stream, run for real over a stand-in bus and database: the resume cursor,
 * the replay of what was missed (in order, before what arrives meanwhile, each message once), the `resync` past the
 * replay limit, and a message marked delivered once.
 */
const bus = vi.hoisted(() => ({ subscribers: new Map<string, Set<(event: unknown) => void>>() }));
const replay = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  /** Runs while the replay query is in flight (events published between subscribe and the end of the replay). */
  during: null as null | (() => void),
}));
const deliveredIds = vi.hoisted(() => [] as string[]);

vi.mock("./realtime", () => ({
  streamTimings: () => ({ retryMs: 2000, heartbeatMs: 60_000, maxLifetimeMs: 0 }),
  subscribe: (topic: string, callback: (event: unknown) => void) => {
    const set = bus.subscribers.get(topic) ?? new Set();
    set.add(callback);
    bus.subscribers.set(topic, set);
    return () => set.delete(callback);
  },
}));
vi.mock("./presence", () => ({
  presenceBeat: vi.fn(async () => undefined),
  presenceLeave: vi.fn(async () => undefined),
  presenceCircle: vi.fn(async () => []),
  presenceOf: vi.fn(async () => ({})),
  presenceTopic: (id: string) => `presence:${id}`,
}));
vi.mock("./messaging", () => ({
  markDelivered: vi.fn(async (id: string) => void deliveredIds.push(id)),
  messageView: (row: Record<string, unknown>) => row,
}));
vi.mock("@orochia/db", () => {
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => {
      replay.during?.();
      return replay.rows;
    },
  };
  return { directMessages: {}, db: { select: () => chain } };
});
vi.mock("drizzle-orm", () => {
  const op = () => ({});
  return { and: op, asc: op, eq: op, gt: op, gte: op, inArray: op, or: op, sql: Object.assign(() => ({}), { raw: op }) };
});

const { REPLAY_LIMIT, parseCursor, userStream } = await import("./chat-stream");

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const message = (seq: number, extra: Record<string, unknown> = {}) => ({
  id: `msg-${seq}`,
  seq,
  conversationId: "c1",
  senderId: OTHER,
  recipientId: ME,
  content: `#${seq}`,
  deliveredAt: null,
  ...extra,
});
const publish = (topic: string, event: unknown) => bus.subscribers.get(topic)?.forEach((callback) => callback(event));

interface Frame {
  id?: string;
  event?: string;
  data?: { type?: string; message?: { id: string; seq: number } };
}

/** Reads the stream's frames until `done` says enough (or the time runs out), then hangs up. */
async function read(response: Response, done: (frames: Frame[]) => boolean, ms = 1000): Promise<Frame[]> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const frames: Frame[] = [];
  let buffer = "";
  const deadline = Date.now() + ms;
  while (!done(frames) && Date.now() < deadline) {
    const chunk = await Promise.race([reader.read(), new Promise<null>((resolve) => setTimeout(() => resolve(null), 50))]);
    if (!chunk) continue;
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    let cut;
    while ((cut = buffer.indexOf("\n\n")) >= 0) {
      const frame: Record<string, unknown> = {};
      for (const line of buffer.slice(0, cut).split("\n")) {
        const m = line.match(/^(\w+): ?(.*)$/);
        if (m) frame[m[1]] = m[1] === "data" ? JSON.parse(m[2]) : m[2];
      }
      buffer = buffer.slice(cut + 2);
      if (frame.data || frame.event) frames.push(frame as Frame);
    }
  }
  await reader.cancel();
  return frames;
}
const messages = (frames: Frame[]) => frames.filter((f) => f.data?.message).map((f) => ({ id: f.id, type: f.data!.type, seq: f.data!.message!.seq }));

beforeEach(() => {
  bus.subscribers.clear();
  replay.rows = [];
  replay.during = null;
  deliveredIds.length = 0;
});
afterEach(() => vi.clearAllMocks());

describe("the stream's resume cursor", () => {
  it("reads Last-Event-ID (m<seq>) and ?after=<seq>, ignores anything else", () => {
    expect(parseCursor("m42")).toBe(42);
    expect(parseCursor("42")).toBe(42);
    expect(parseCursor(" m7 ")).toBe(7);
    expect(parseCursor("garbage")).toBeNull();
    expect(parseCursor("m-1")).toBeNull();
    expect(parseCursor(null)).toBeNull();
  });
});

describe("an account's live stream", () => {
  it("opens with `connected` (not resumed) and relays the account's events live, messages with their cursor as id", async () => {
    const response = userStream(ME, { cursor: null });
    const frames = read(response, (f) => f.some((x) => x.data?.type === "notification"));
    await vi.waitFor(() => expect(bus.subscribers.get(`user:${ME}`)?.size).toBe(1));
    publish(`user:${ME}`, { type: "new_message", message: message(5) });
    publish(`user:${ME}`, { type: "notification", notification: { id: "n1" } });
    const got = await frames;
    expect(got[0]).toMatchObject({ event: "connected" });
    expect((got[0].data as { resumed: boolean }).resumed).toBe(false);
    expect(messages(got)).toEqual([{ id: "m5", type: "new_message", seq: 5 }]);
  });

  it("a resumed stream replays what was missed, in order, before what arrives meanwhile", async () => {
    replay.rows = [message(11), message(12, { senderId: ME, recipientId: OTHER })];
    replay.during = () => publish(`user:${ME}`, { type: "new_message", message: message(13) });
    const got = await read(userStream(ME, { cursor: 10 }), (f) => messages(f).length >= 3);
    expect((got[0].data as { resumed: boolean }).resumed).toBe(true);
    expect(messages(got)).toEqual([
      { id: "m11", type: "new_message", seq: 11 },
      // The account's own message, sent from another app while this one was away.
      { id: "m12", type: "message_sent", seq: 12 },
      { id: "m13", type: "new_message", seq: 13 },
    ]);
  });

  it("a message both replayed and published during the replay is sent once", async () => {
    // Committed while the client was away, its live event lands while the replay query runs: both carry seq 11.
    replay.rows = [message(11)];
    replay.during = () => publish(`user:${ME}`, { type: "new_message", message: message(11) });
    const got = await read(userStream(ME, { cursor: 10 }), (f) => f.some((x) => x.data?.type === "presence_snapshot"));
    expect(messages(got)).toEqual([{ id: "m11", type: "new_message", seq: 11 }]);
  });

  it("past the replay limit, asks the client to reload instead of replaying", async () => {
    replay.rows = Array.from({ length: REPLAY_LIMIT + 1 }, (_, i) => message(i + 1));
    const got = await read(userStream(ME, { cursor: 0 }), (f) => f.some((x) => x.data?.type === "presence_snapshot"));
    expect(got.some((f) => f.data?.type === "resync")).toBe(true);
    expect(messages(got)).toEqual([]);
  });

  it("marks a message delivered once, however many of the account's streams receive it", async () => {
    const a = read(userStream(ME, { cursor: null }), (f) => messages(f).length >= 1);
    const b = read(userStream(ME, { cursor: null }), (f) => messages(f).length >= 1);
    await vi.waitFor(() => expect(bus.subscribers.get(`user:${ME}`)?.size).toBe(2));
    publish(`user:${ME}`, { type: "new_message", message: message(21) });
    await Promise.all([a, b]);
    expect(deliveredIds).toEqual(["msg-21"]);
  });

  it("drops its subscriptions when the client goes away", async () => {
    await read(userStream(ME, { cursor: null }), (f) => f.some((x) => x.data?.type === "presence_snapshot"));
    await vi.waitFor(() => expect(bus.subscribers.get(`user:${ME}`)?.size ?? 0).toBe(0));
  });
});
