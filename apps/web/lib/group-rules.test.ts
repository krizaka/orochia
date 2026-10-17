import { describe, expect, it } from "vitest";

import { canAddMembers, GROUP_TITLE_MAX, inviteState, isMuted, MAX_GROUP_MEMBERS, nextOwner, parseGroupTitle } from "./group-rules";

const now = new Date("2026-10-17T12:00:00Z");
const later = new Date("2026-10-24T12:00:00Z");
const earlier = new Date("2026-10-10T12:00:00Z");

describe("a group holds at most 50 people (ADR 0002)", () => {
  it("counts the people already in", () => {
    expect(MAX_GROUP_MEMBERS).toBe(50);
    expect(canAddMembers(49, 1)).toBe(true);
    expect(canAddMembers(50, 1)).toBe(false);
    expect(canAddMembers(40, 11)).toBe(false);
    expect(canAddMembers(1, 0)).toBe(false);
  });
});

describe("the title", () => {
  it("is trimmed, collapsed, and never empty or too long", () => {
    expect(parseGroupTitle("  Fans   club ")).toBe("Fans club");
    expect(parseGroupTitle("   ")).toBeNull();
    expect(parseGroupTitle("x".repeat(GROUP_TITLE_MAX + 1))).toBeNull();
  });
});

describe("the owner leaves", () => {
  it("passes the group to the longest-standing member, or closes it when alone", () => {
    const members = [
      { userId: "b", joinedAt: new Date("2026-10-02") },
      { userId: "c", joinedAt: new Date("2026-10-01") },
    ];
    expect(nextOwner(members)).toBe("c");
    expect(nextOwner([])).toBeNull();
  });
});

describe("mute", () => {
  it("is a date: muted until then", () => {
    expect(isMuted(later, now)).toBe(true);
    expect(isMuted(earlier, now)).toBe(false);
    expect(isMuted(null, now)).toBe(false);
  });
});

describe("an invite link", () => {
  const base = { expiresAt: later, revokedAt: null, uses: 0, maxUses: 5 };
  it("works while it is valid and there is room", () => {
    expect(inviteState(base, now, 10)).toBe("ok");
  });
  it("says why it does not", () => {
    expect(inviteState({ ...base, expiresAt: earlier }, now, 10)).toBe("expired");
    expect(inviteState({ ...base, revokedAt: earlier }, now, 10)).toBe("revoked");
    expect(inviteState({ ...base, uses: 5 }, now, 10)).toBe("exhausted");
    expect(inviteState(base, now, 0)).toBe("full");
  });
});
