import { describe, expect, it } from "vitest";

import { realtimeConfig } from "./env";
import { type PresenceFacts, presenceVisible } from "./presence-rules";

const base: PresenceFacts = {
  viewerId: "v",
  subjectId: "s",
  viewerActive: true,
  subjectActive: true,
  blockedEitherWay: false,
  viewerShows: true,
  subjectShows: true,
  acceptedContact: false,
  exchanged: false,
  approvedFollowOfCreator: false,
};

describe("who sees whom online", () => {
  it("nobody without a relationship both sides chose — not even an admin, not a stranger who wrote first", () => {
    expect(presenceVisible(base)).toBe(false);
  });

  it("accepted contacts, people who have talked, and the fan of a creator who approved them", () => {
    expect(presenceVisible({ ...base, acceptedContact: true })).toBe(true);
    expect(presenceVisible({ ...base, exchanged: true })).toBe(true);
    expect(presenceVisible({ ...base, approvedFollowOfCreator: true })).toBe(true);
  });

  it("never across a block, whatever else links them", () => {
    expect(presenceVisible({ ...base, acceptedContact: true, exchanged: true, blockedEitherWay: true })).toBe(false);
  });

  it("hiding one's presence hides it — and hides everyone else's from them", () => {
    expect(presenceVisible({ ...base, exchanged: true, subjectShows: false })).toBe(false);
    expect(presenceVisible({ ...base, exchanged: true, viewerShows: false })).toBe(false);
  });

  it("never for a suspended account or oneself", () => {
    expect(presenceVisible({ ...base, exchanged: true, subjectActive: false })).toBe(false);
    expect(presenceVisible({ ...base, exchanged: true, viewerActive: false })).toBe(false);
    expect(presenceVisible({ ...base, subjectId: "v", exchanged: true })).toBe(false);
  });
});

describe("realtime configuration", () => {
  it("defaults to the PostgreSQL bus and a 5-minute stream", () => {
    expect(realtimeConfig({})).toMatchObject({ kind: "postgres", streamMaxSeconds: 300 });
  });

  it("fails closed: redis without REALTIME_REDIS_URL, or an unknown bus, is a configuration error", () => {
    expect(() => realtimeConfig({ REALTIME_BUS: "redis" })).toThrow(/REALTIME_REDIS_URL/);
    expect(() => realtimeConfig({ REALTIME_BUS: "kafka" })).toThrow(/REALTIME_BUS/);
    expect(realtimeConfig({ REALTIME_BUS: "redis", REALTIME_REDIS_URL: "rediss://cache:25061" })).toMatchObject({ kind: "redis", redisUrl: "rediss://cache:25061" });
  });
});
