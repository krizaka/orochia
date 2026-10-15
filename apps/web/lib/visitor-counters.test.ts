import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { publicActionsOn } from "./public-actions";

const recordStoryView = vi.fn(async () => true);
const recordShare = vi.fn(async () => ({ shares: 1 }));

vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => null }));
vi.mock("@/lib/stories", () => ({ recordStoryView: (...args: unknown[]) => recordStoryView(...(args as [])) }));
vi.mock("@/lib/engagement", () => ({ SHARE_CHANNELS: ["LINK", "EMAIL"] as const, recordShare: (...args: unknown[]) => recordShare(...(args as [])) }));

const ID = "11111111-1111-4111-8111-111111111111";
const req = (path: string) => new NextRequest(`https://dev.orochia.com${path}`, { method: "POST", headers: { "x-forwarded-for": "203.0.113.7", "user-agent": "test" } });

describe("APP_PUBLIC_ACTIONS (dev: a signed-out visitor's actions are accepted but not counted)", () => {
  const before = process.env.APP_PUBLIC_ACTIONS;
  beforeEach(() => {
    recordStoryView.mockClear();
    recordShare.mockClear();
  });
  afterEach(() => {
    if (before === undefined) delete process.env.APP_PUBLIC_ACTIONS;
    else process.env.APP_PUBLIC_ACTIONS = before;
  });

  it("is on unless it says off", () => {
    expect(publicActionsOn(undefined)).toBe(true);
    expect(publicActionsOn("on")).toBe(true);
    expect(publicActionsOn("off")).toBe(false);
  });

  it("off: a signed-out story view answers 204 and writes nothing", async () => {
    process.env.APP_PUBLIC_ACTIONS = "off";
    const { POST } = await import("../app/api/stories/[id]/view/route");
    const res = await POST(req(`/api/stories/${ID}/view`), { params: Promise.resolve({ id: ID }) });
    expect(res.status).toBe(204);
    expect(recordStoryView).not.toHaveBeenCalled();
  });

  it("on: a signed-out story view is counted through the same path", async () => {
    process.env.APP_PUBLIC_ACTIONS = "on";
    const { POST } = await import("../app/api/stories/[id]/view/route");
    const res = await POST(req(`/api/stories/${ID}/view`), { params: Promise.resolve({ id: ID }) });
    expect(res.status).toBe(200);
    expect(recordStoryView).toHaveBeenCalledTimes(1);
  });

  it("off: a signed-out share answers 204 and writes nothing", async () => {
    process.env.APP_PUBLIC_ACTIONS = "off";
    const { POST } = await import("../app/api/videos/[id]/shares/route");
    const res = await POST(req(`/api/videos/${ID}/shares`), { params: Promise.resolve({ id: ID }) });
    expect(res.status).toBe(204);
    expect(recordShare).not.toHaveBeenCalled();
  });

  it("in every environment: a signed-out visitor's share is counted once per video and channel per hour", async () => {
    process.env.APP_PUBLIC_ACTIONS = "on";
    const { POST } = await import("../app/api/videos/[id]/shares/route");
    const first = await POST(req(`/api/videos/${ID}/shares`), { params: Promise.resolve({ id: ID }) });
    const second = await POST(req(`/api/videos/${ID}/shares`), { params: Promise.resolve({ id: ID }) });
    expect(first.status).toBe(201);
    expect(second.status).toBe(204);
    expect(recordShare).toHaveBeenCalledTimes(1);
  });
});
