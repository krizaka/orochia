import { describe, expect, it } from "vitest";
import { clientIp, playbackIp } from "./client-ip";

const h = (headers: Record<string, string>) => new Headers(headers);

describe("clientIp", () => {
  it("reads the address the trusted proxy appended (right-most), never the client's own claim", () => {
    expect(clientIp(h({ "x-forwarded-for": "6.6.6.6, 198.51.100.4" }), {})).toBe("198.51.100.4");
    expect(clientIp(h({ "x-forwarded-for": "198.51.100.4" }), {})).toBe("198.51.100.4");
  });

  it("skips as many proxies as configured", () => {
    expect(clientIp(h({ "x-forwarded-for": "6.6.6.6, 198.51.100.4, 10.0.0.2" }), { TRUSTED_PROXY_HOPS: "2" })).toBe("198.51.100.4");
  });

  it("prefers the edge's own header when configured, and ignores garbage", () => {
    expect(clientIp(h({ "do-connecting-ip": "203.0.113.9", "x-forwarded-for": "1.1.1.1" }), { CLIENT_IP_HEADER: "do-connecting-ip" })).toBe("203.0.113.9");
    expect(clientIp(h({ "do-connecting-ip": "not-an-ip", "x-forwarded-for": "1.1.1.1" }), { CLIENT_IP_HEADER: "do-connecting-ip" })).toBe("1.1.1.1");
    expect(clientIp(h({ "x-forwarded-for": "999.1.1.1" }), {})).toBeNull();
    expect(clientIp(h({ "x-forwarded-for": "2001:db8::1" }), {})).toBe("2001:db8::1");
    expect(clientIp(h({}), {})).toBeNull();
  });

  it("binds playback tokens to the address only when asked", () => {
    const headers = h({ "x-forwarded-for": "198.51.100.4" });
    expect(playbackIp(headers, {})).toBeUndefined();
    expect(playbackIp(headers, { BUNNY_TOKEN_BIND_IP: "on" })).toBe("198.51.100.4");
  });
});
