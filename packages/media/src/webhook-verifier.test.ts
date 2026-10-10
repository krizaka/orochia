import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { verifyBunnyWebhookSignature } from "./webhook-verifier";

const KEY = "read-only-key";
const body = JSON.stringify({ VideoLibraryId: 773325, VideoGuid: "9858b4b7-1d10-4ed0-83b1-1f31f527ccbe", Status: 3 });
const sign = (raw: string, key = KEY) => crypto.createHmac("sha256", key).update(raw).digest("hex");
const headers = (signature: string, version = "v1", algorithm = "hmac-sha256") =>
  new Headers({ "X-BunnyStream-Signature": signature, "X-BunnyStream-Signature-Version": version, "X-BunnyStream-Signature-Algorithm": algorithm });

describe("verifyBunnyWebhookSignature (v1, HMAC-SHA256 of the raw body)", () => {
  it("accepts Bunny's signature", () => {
    expect(verifyBunnyWebhookSignature({ rawBody: body, headers: headers(sign(body)), signingKey: KEY })).toBe(true);
  });
  it("refuses a modified body, another key, another version or algorithm", () => {
    expect(verifyBunnyWebhookSignature({ rawBody: body.replace("3}", "5}"), headers: headers(sign(body)), signingKey: KEY })).toBe(false);
    expect(verifyBunnyWebhookSignature({ rawBody: body, headers: headers(sign(body, "other")), signingKey: KEY })).toBe(false);
    expect(verifyBunnyWebhookSignature({ rawBody: body, headers: headers(sign(body), "v2"), signingKey: KEY })).toBe(false);
    expect(verifyBunnyWebhookSignature({ rawBody: body, headers: headers(sign(body), "v1", "sha1"), signingKey: KEY })).toBe(false);
  });
  it("refuses everything when no key is configured", () => {
    expect(verifyBunnyWebhookSignature({ rawBody: body, headers: headers(sign(body, "")), signingKey: "" })).toBe(false);
  });
});
