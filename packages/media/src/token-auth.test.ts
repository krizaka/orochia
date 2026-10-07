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

describe("Bunny webhook signature (v1)", () => {
  const key = "ae031f66-read-only-key";
  const body = JSON.stringify({ VideoLibraryId: 773325, VideoGuid: "657bb740-a71b-4529-a012-528021c31a92", Status: 3 });
  const sign = (secret: string, raw = body) => crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const headers = (signature: string, version = "v1", algorithm = "hmac-sha256") =>
    new Headers({ "X-BunnyStream-Signature": signature, "X-BunnyStream-Signature-Version": version, "X-BunnyStream-Signature-Algorithm": algorithm });

  it("accepts the HMAC-SHA256 of the raw body keyed with the read-only API key", () => {
    expect(verifyBunnyWebhookSignature({ rawBody: body, headers: headers(sign(key)), signingKey: key })).toBe(true);
  });

  it("refuses another key, a changed body, another version or algorithm, a malformed signature", () => {
    expect(verifyBunnyWebhookSignature({ rawBody: body, headers: headers(sign("other")), signingKey: key })).toBe(false);
    expect(verifyBunnyWebhookSignature({ rawBody: body + " ", headers: headers(sign(key)), signingKey: key })).toBe(false);
    expect(verifyBunnyWebhookSignature({ rawBody: body, headers: headers(sign(key), "v2"), signingKey: key })).toBe(false);
    expect(verifyBunnyWebhookSignature({ rawBody: body, headers: headers(sign(key), "v1", "sha1"), signingKey: key })).toBe(false);
    expect(verifyBunnyWebhookSignature({ rawBody: body, headers: headers(sign(key).toUpperCase()), signingKey: key })).toBe(false);
    expect(verifyBunnyWebhookSignature({ rawBody: body, headers: new Headers(), signingKey: key })).toBe(false);
  });

  it("refuses everything when no key is configured", () => {
    expect(verifyBunnyWebhookSignature({ rawBody: body, headers: headers(sign("")), signingKey: "" })).toBe(false);
  });

  it("maps the documented status codes: only 'finished' is READY", () => {
    expect(mapBunnyStatusToOrochia(3)).toBe("READY");
    expect(mapBunnyStatusToOrochia(4)).toBe("PROCESSING");
    for (const code of [0, 1, 2, 6, 7]) expect(mapBunnyStatusToOrochia(code)).toBe("PROCESSING");
    expect(mapBunnyStatusToOrochia(5)).toBe("FAILED");
    expect(mapBunnyStatusToOrochia(8)).toBe("FAILED");
    expect(mapBunnyStatusToOrochia(9)).toBeNull();
    expect(mapBunnyStatusToOrochia(10)).toBeNull();
  });
});
