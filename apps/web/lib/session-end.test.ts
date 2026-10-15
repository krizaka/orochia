import { describe, expect, it } from "vitest";

import { signSessionToken, verifySessionToken } from "./auth";
import { issuedBefore } from "./session-revocation";

const user = { id: "u1", username: "eric", email: "eric@example.test", role: "MEMBER" as const, isAgeVerified: true, emailVerified: true };
const secret = "s".repeat(32);

describe("a session carries when it was issued", () => {
  it("to the second, from its expiry", () => {
    const now = Date.UTC(2026, 9, 15, 12, 0, 30, 450);
    const session = verifySessionToken(signSessionToken(user, secret, now), secret, now + 1000);
    expect(session?.issuedAt).toBe(Date.UTC(2026, 9, 15, 12, 0, 30, 0));
  });
});

describe("ending every session of an account", () => {
  const ended = new Date(Date.UTC(2026, 9, 15, 12, 0, 30, 450));
  it("refuses a token issued before, never one issued after", () => {
    expect(issuedBefore(Date.UTC(2026, 9, 15, 11, 0, 0), ended)).toBe(true);
    expect(issuedBefore(Date.UTC(2026, 9, 15, 12, 0, 31), ended)).toBe(false);
  });
  it("lets in a person who signs in the second the operator acted", () => {
    expect(issuedBefore(Date.UTC(2026, 9, 15, 12, 0, 30, 0), ended)).toBe(false);
  });
  it("refuses nothing when nobody ended anything", () => {
    expect(issuedBefore(Date.UTC(2026, 9, 15, 11, 0, 0), null)).toBe(false);
    expect(issuedBefore(undefined, null)).toBe(false);
  });
  it("refuses a token of unknown age once sessions were ended", () => {
    expect(issuedBefore(undefined, ended)).toBe(true);
  });
});
