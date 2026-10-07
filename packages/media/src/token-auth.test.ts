import crypto from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateBunnyStreamToken } from "./token-auth";
import { verifyBunnyWebhookSignature, mapBunnyStatusToOrochia } from "./webhook-verifier";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("Bunny stream token", () => {
  it("signs the video directory and carries the token in the path, for every HLS segment", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T00:00:00Z"));
    const result = generateBunnyStreamToken({
      hostname: "vz-1.b-cdn.net",
      videoGuid: "abc",
      tokenAuthKey: "secret",
      expiresInSeconds: 300,
    });
    const expires = Math.floor(Date.parse("2026-10-06T00:00:00Z") / 1000) + 300;
    const expected = crypto
      .createHash("sha256")
      .update(`secret/abc/${expires}token_path=/abc/`)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(result.expires).toBe(expires);
    expect(result.token).toBe(expected);
    expect(result.directM3u8Url).toBe(`https://vz-1.b-cdn.net/bcdn_token=${expected}&expires=${expires}&token_path=%2Fabc%2F/abc/playlist.m3u8`);
  });
});

describe("Bunny webhook signature", () => {
  const body = JSON.stringify({ VideoGuid: "abc", Status: 4 });
  const sign = (secret: string) => crypto.createHmac("sha256", secret).update(body).digest("hex");

  it("accepts the HMAC of the raw body and refuses anything else", () => {
    expect(verifyBunnyWebhookSignature({ rawBody: body, signatureHeader: sign("s3cret"), webhookSecret: "s3cret" })).toBe(true);
    expect(verifyBunnyWebhookSignature({ rawBody: body, signatureHeader: sign("other"), webhookSecret: "s3cret" })).toBe(false);
    expect(verifyBunnyWebhookSignature({ rawBody: body, signatureHeader: null, webhookSecret: "s3cret" })).toBe(false);
    expect(verifyBunnyWebhookSignature({ rawBody: body + " ", signatureHeader: sign("s3cret"), webhookSecret: "s3cret" })).toBe(false);
  });

  it("never accepts an unsigned call in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(verifyBunnyWebhookSignature({ rawBody: body, signatureHeader: "", webhookSecret: "" })).toBe(false);
  });

  it("maps encoding states", () => {
    expect(mapBunnyStatusToOrochia(4)).toBe("READY");
    expect(mapBunnyStatusToOrochia(3)).toBe("PROCESSING");
    expect(mapBunnyStatusToOrochia(5)).toBe("FAILED");
  });
});
