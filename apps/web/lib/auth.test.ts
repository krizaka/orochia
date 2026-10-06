import { describe, expect, it } from "vitest";
import { signSessionToken, verifySessionToken, SESSION_TTL_SECONDS } from "./auth";

const SECRET = "test-secret-that-is-long-enough-0123456789";
const user = { id: "u1", username: "ada", email: "ada@example.com", role: "MEMBER" as const, isAgeVerified: true };

describe("session tokens", () => {
  it("round-trips a session", () => {
    const now = Date.now();
    expect(verifySessionToken(signSessionToken(user, SECRET, now), SECRET, now)).toEqual(user);
  });

  it("refuses a forged or tampered token", () => {
    const token = signSessionToken(user, SECRET);
    expect(verifySessionToken(token, "another-secret-that-is-long-enough-xx")).toBeNull();
    const [data, sig] = token.split(".");
    const elevated = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(data, "base64url").toString()), role: "ADMIN" }),
    ).toString("base64url");
    expect(verifySessionToken(`${elevated}.${sig}`, SECRET)).toBeNull();
    expect(verifySessionToken("garbage", SECRET)).toBeNull();
  });

  it("expires", () => {
    const issued = Date.now();
    const token = signSessionToken(user, SECRET, issued);
    expect(verifySessionToken(token, SECRET, issued + (SESSION_TTL_SECONDS - 1) * 1000)).not.toBeNull();
    expect(verifySessionToken(token, SECRET, issued + (SESSION_TTL_SECONDS + 1) * 1000)).toBeNull();
  });
});
