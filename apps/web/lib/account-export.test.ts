import { describe, expect, it } from "vitest";

import { type ExportRows, shapeExport } from "./account-export";

const when = new Date("2026-10-15T12:00:00Z");
const rows: ExportRows = {
  user: { id: "u1", email: "eric@example.test", username: "eric", role: "CREATOR", isVerified: true, isAgeVerified: true, dateOfBirth: "1990-01-01", emailVerifiedAt: when, suspendedAt: null, createdAt: when, lastSeenAt: null },
  profile: { displayName: "Eric", bio: "hi", websiteUrl: null, socialLinks: {}, minTipAmountCents: 500 },
  videos: [{ id: "v1", title: "Harbour", description: null, visibility: "PUBLIC", status: "READY", viewsCount: 3, tipsCount: 1, createdAt: when, removedAt: null, removalReason: null }],
  tipsSent: [{ id: "t1", videoId: "v9", creatorId: "c1", grossAmountCents: 500, note: null, createdAt: when }],
  tipsReceived: [{ id: "t2", videoId: "v1", grossAmountCents: 1000, platformFeeCents: 100, netAmountCents: 900, createdAt: when }],
  wallet: [{ entryType: "TOPUP", amountCents: 2000, reference: "topup:1", note: null, createdAt: when }],
  payouts: [{ id: "p1", amountCents: 900, status: "SETTLED", payoutMethod: "CRYPTO_USDT", createdAt: when, settledAt: when }],
};

describe("the Law 25 export of an account", () => {
  const out = shapeExport(rows, when);
  const text = JSON.stringify(out);
  it("carries the account, its profile, its videos and its money, in integer cents", () => {
    expect(out).toMatchObject({ format: "orochia-account-export/1", account: { email: "eric@example.test" }, profile: { displayName: "Eric" } });
    expect((out.videos as unknown[]).length).toBe(1);
    expect(out.tipsReceived).toEqual([expect.objectContaining({ grossAmountCents: 1000, platformFeeCents: 100, netAmountCents: 900 })]);
  });
  it("never holds a password hash, a payout destination or a session token", () => {
    expect(text).not.toMatch(/password|passwordHash|payoutDestination|payout_destination|token/i);
  });
  it("dates are ISO strings", () => {
    expect((out.account as { createdAt: string }).createdAt).toBe("2026-10-15T12:00:00.000Z");
  });
});
