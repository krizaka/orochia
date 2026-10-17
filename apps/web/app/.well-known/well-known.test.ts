import { afterEach, describe, expect, it, vi } from "vitest";

import { GET as assetlinks } from "./assetlinks.json/route";
import { GET as aasa } from "./apple-app-site-association/route";

const FP = Array.from({ length: 32 }, () => "AB").join(":");

describe("/.well-known files", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("the AASA answers 200 application/json with the appID, and no redirect", async () => {
    vi.stubEnv("APP_IOS_TEAM_ID", "ABCDE12345");
    const res = aasa();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect(((await res.json()) as { applinks: { details: { appIDs: string[] }[] } }).applinks.details[0].appIDs).toEqual(["ABCDE12345.com.krizaka.orochia"]);
  });

  it("assetlinks.json answers 200 application/json with the package and fingerprint", async () => {
    vi.stubEnv("APP_ANDROID_CERT_SHA256", FP);
    const res = assetlinks();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    const [link] = (await res.json()) as { target: { package_name: string; sha256_cert_fingerprints: string[] } }[];
    expect(link.target).toMatchObject({ package_name: "com.krizaka.orochia", sha256_cert_fingerprints: [FP] });
  });

  it("without its setting a file is a 404, never a placeholder", () => {
    vi.stubEnv("APP_IOS_TEAM_ID", "");
    vi.stubEnv("APP_ANDROID_CERT_SHA256", "");
    expect(aasa().status).toBe(404);
    expect(assetlinks().status).toBe(404);
  });
});
