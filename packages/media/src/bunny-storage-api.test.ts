import { afterEach, describe, expect, it, vi } from "vitest";
import { getLibraryTotals, getStorageZoneTotals } from "./bunny-account";
import { BunnyApiError, BunnyStreamClient } from "./bunny-client";

afterEach(() => vi.restoreAllMocks());

const client = () => new BunnyStreamClient({ apiKey: "k", libraryId: 42, hostname: "vz.b-cdn.net", tokenAuthKey: "t" });
const video = (guid: string, storageSize: number) => ({ guid, storageSize, length: 10, title: guid, status: 4 });

describe("listing the library (the reconciliation's input)", () => {
  it("reads every page of 1000 until the total is reached", async () => {
    const pages = [
      { totalItems: 3, currentPage: 1, itemsPerPage: 2, items: [video("a", 1), video("b", 2)] },
      { totalItems: 3, currentPage: 2, itemsPerPage: 2, items: [video("c", 3)] },
    ];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const page = Number(new URL(String(url)).searchParams.get("page"));
      return new Response(JSON.stringify(pages[page - 1]));
    });
    const all = await client().listAllVideos();
    expect(all.map((v) => v.guid)).toEqual(["a", "b", "c"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://video.bunnycdn.com/library/42/videos?page=1&itemsPerPage=1000&orderBy=date");
    expect((init?.headers as Record<string, string>).AccessKey).toBe("k");
  });

  it("stops on an empty page and reports API errors with their status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ totalItems: 10, items: [] })));
    expect(await client().listAllVideos()).toEqual([]);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("nope", { status: 401 }));
    await expect(client().listVideos()).rejects.toBeInstanceOf(BunnyApiError);
  });
});

describe("the account API (optional totals)", () => {
  it("reads the library's and a storage zone's totals", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const path = new URL(String(url)).pathname + new URL(String(url)).search;
      if (path === "/videolibrary/42") return new Response(JSON.stringify({ StorageUsage: 5_000, TrafficUsage: 9, VideoCount: 3 }));
      if (path === "/storagezone/7") return new Response(JSON.stringify({ StorageUsed: 1234, FilesStored: 12 }));
      if (path.startsWith("/storagezone?")) return new Response(JSON.stringify({ Items: [{ Name: "other" }, { Name: "orochia-media", StorageUsed: 99, FilesStored: 1 }] }));
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    expect(await getLibraryTotals(42, "acct", fetchImpl)).toEqual({ storageBytes: 5000, trafficBytes: 9, videoCount: 3 });
    expect(await getStorageZoneTotals({ id: 7 }, "acct", fetchImpl)).toEqual({ storageBytes: 1234, files: 12 });
    expect(await getStorageZoneTotals({ name: "orochia-media" }, "acct", fetchImpl)).toEqual({ storageBytes: 99, files: 1 });
    expect(await getStorageZoneTotals({ name: "missing" }, "acct", fetchImpl)).toBeNull();
    await expect(getLibraryTotals(1, "acct", fetchImpl)).rejects.toThrow(/404/);
  });
});
