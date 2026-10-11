import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The order that matters: an upload that does not fit is refused BEFORE Bunny is asked for anything — no video slot
 * created, no Tus signature issued. The route runs for real; the session, the database, Bunny and the usage figures are
 * stand-ins, and the quota decision is the real one (lib/quotas.ts).
 */
const bunny = vi.hoisted(() => ({ createTusUploadSession: vi.fn() }));
const usage = vi.hoisted(() => ({ creatorBytes: 0, platformBytes: 0, today: 0 }));
const inserted = vi.hoisted(() => ({ values: null as Record<string, unknown> | null }));

vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), after: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => ({ id: "11111111-1111-4111-8111-111111111111", role: "CREATOR" })) }));
vi.mock("@/lib/env", async (original) => ({
  ...(await original<typeof import("./env")>()),
  requireBunnyStream: () => ({ apiKey: "k", libraryId: 1, hostname: "h", tokenAuthKey: "t" }),
}));
vi.mock("@orochia/media", async (original) => ({
  ...(await original<typeof import("@orochia/media")>()),
  BunnyStreamClient: vi.fn(function BunnyStreamClient() {
    return bunny;
  }),
}));
vi.mock("@orochia/db", () => {
  const chain = { from: () => chain, where: () => chain, limit: async () => [{ isVerified: true }] };
  return {
    users: {},
    videos: {},
    db: {
      select: () => chain,
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          inserted.values = values;
          return { returning: async () => [{ id: "22222222-2222-4222-8222-222222222222" }] };
        },
      }),
    },
  };
});
vi.mock("@/lib/storage-usage", async () => {
  const { evaluateUpload, quotaConfig } = await import("./quotas");
  const { HttpError } = await import("./http");
  return {
    checkPlatformAlerts: vi.fn(),
    assertUploadAllowed: vi.fn(async (_userId: string, request: { kind: "video"; sizeBytes: number; durationSeconds?: number }) => {
      const config = quotaConfig();
      const decision = evaluateUpload(request, {
        config,
        creator: { usage: { bytes: usage.creatorBytes, seconds: 0 }, allowance: config.plans.default },
        platform: { usage: { bytes: usage.platformBytes, seconds: 0 } },
        today: { count: usage.today, oldestAt: new Date(Date.now() - 3600_000) },
        concurrent: 0,
      });
      if (!decision.ok) throw new HttpError(decision.status, decision.message, { code: decision.code }, decision.retryAfterSeconds ? { "Retry-After": String(decision.retryAfterSeconds) } : {});
    }),
  };
});

const { POST } = await import("../app/api/videos/create-upload-session/route");
const { useRateLimitStore, memoryStore } = await import("./rate-limit");

const GB = 1024 ** 3;
const body = (sizeBytes: number, extra: Record<string, unknown> = {}) =>
  new NextRequest("http://localhost/api/videos/create-upload-session", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0", "x-forwarded-for": "203.0.113.1" },
    body: JSON.stringify({ title: "My video", visibility: "PUBLIC", minTipAmountCents: 0, tags: [], sizeBytes, ...extra }),
  });

beforeEach(() => {
  useRateLimitStore(memoryStore());
  bunny.createTusUploadSession.mockReset().mockResolvedValue({ videoGuid: "33333333-3333-4333-8333-333333333333", headers: {} });
  Object.assign(usage, { creatorBytes: 0, platformBytes: 0, today: 0 });
  inserted.values = null;
});
afterEach(() => {
  useRateLimitStore(null);
  vi.unstubAllEnvs();
});

describe("POST /api/videos/create-upload-session — quotas before the signature", () => {
  it("signs an upload that fits and records its declared size", async () => {
    const res = await POST(body(GB, { durationSeconds: 120 }));
    expect(res.status).toBe(200);
    expect(bunny.createTusUploadSession).toHaveBeenCalledOnce();
    expect(inserted.values).toMatchObject({ storageBytes: GB, status: "PENDING_UPLOAD" });
  });

  it("refuses beyond the creator's plan with 413 CREATOR_STORAGE_FULL — Bunny never asked", async () => {
    usage.creatorBytes = 9.5 * GB;
    const res = await POST(body(GB));
    expect(res.status).toBe(413);
    expect((await res.json()).code).toBe("CREATOR_STORAGE_FULL");
    expect(bunny.createTusUploadSession).not.toHaveBeenCalled();
    expect(inserted.values).toBeNull();
  });

  it("refuses when the platform is full (413 PLATFORM_STORAGE_FULL)", async () => {
    usage.platformBytes = 100 * GB;
    const res = await POST(body(1024));
    expect(res.status).toBe(413);
    expect((await res.json()).code).toBe("PLATFORM_STORAGE_FULL");
    expect(bunny.createTusUploadSession).not.toHaveBeenCalled();
  });

  it("refuses past the uploads of the day with 429 and Retry-After", async () => {
    usage.today = 50;
    const res = await POST(body(1024));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("UPLOADS_PER_DAY");
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(3600);
    expect(bunny.createTusUploadSession).not.toHaveBeenCalled();
  });

  it("refuses a lowered per-file maximum (QUOTA_VIDEO_MAX_MB)", async () => {
    vi.stubEnv("QUOTA_VIDEO_MAX_MB", "100");
    const res = await POST(body(200 * 1024 ** 2));
    expect(res.status).toBe(413);
    expect((await res.json()).code).toBe("FILE_TOO_LARGE");
    expect(bunny.createTusUploadSession).not.toHaveBeenCalled();
  });

  it("rate-limits upload sessions per account with Retry-After", async () => {
    for (let i = 0; i < 10; i++) expect((await POST(body(1024))).status).toBe(200);
    const res = await POST(body(1024));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(bunny.createTusUploadSession).toHaveBeenCalledTimes(10);
  });
});
