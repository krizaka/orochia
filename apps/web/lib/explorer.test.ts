import { describe, expect, it } from "vitest";

import { documentHash, fuseRankings, MAX_DOCUMENT_CHARS, normalizeQuery, VectorCache, vectorLiteral, videoDocument } from "./explorer";

describe("videoDocument — what leaves for Orazaka", () => {
  it("is the title, the tags and the description, and nothing else", () => {
    const doc = videoDocument({ title: "Sunrise over Tokyo", tags: ["travel", "city"], description: "A slow morning." });
    expect(doc).toBe("Sunrise over Tokyo\nTags: travel, city\nA slow morning.");
  });

  it("has no field for a creator, a comment, a price or a link: the type carries three strings", () => {
    const doc = videoDocument({ title: "t", tags: null, description: null, creator: "elena", priceCents: 500 } as never);
    expect(doc).toBe("t");
  });

  it("folds whitespace, drops control characters and cuts a long description", () => {
    const doc = videoDocument({ title: "  Neon \u0000 lights\n\n", tags: [" a ", ""], description: "x".repeat(5000) })!;
    expect(doc.startsWith("Neon lights\nTags: a\nxxx")).toBe(true);
    expect(doc.length).toBe(MAX_DOCUMENT_CHARS);
    expect(doc).not.toContain("\u0000");
  });

  it("is null for a video without a title", () => {
    expect(videoDocument({ title: "  \n", tags: ["a"], description: "b" })).toBeNull();
  });
});

describe("documentHash / normalizeQuery / vectorLiteral", () => {
  it("hashes the same text to the same fingerprint, a changed text to another", () => {
    expect(documentHash("a")).toBe(documentHash("a"));
    expect(documentHash("a")).not.toBe(documentHash("b"));
    expect(documentHash("a")).toHaveLength(64);
  });

  it("makes 'Tokyo  Neon' and ' tokyo neon ' the same search", () => {
    expect(normalizeQuery("  Tokyo   Neon ")).toBe("tokyo neon");
    expect(normalizeQuery("x".repeat(300))).toHaveLength(100);
  });

  it("writes a vector the way pgvector reads it", () => {
    expect(vectorLiteral([0.5, -1, 2])).toBe("[0.5,-1,2]");
  });
});

describe("fuseRankings — full-text and meaning, merged", () => {
  it("puts what both lists found first, then each list's own best", () => {
    const fused = fuseRankings(["a", "b", "c"], ["c", "d", "a"]);
    expect(fused.map((f) => f.id)).toEqual(["a", "c", "b", "d"]);
    expect(Object.fromEntries(fused.map((f) => [f.id, f.via]))).toEqual({ a: "both", c: "both", b: "text", d: "meaning" });
  });

  it("is just the text ranking when meaning found nothing (Orazaka down, no embeddings yet)", () => {
    expect(fuseRankings(["a", "b"], [])).toEqual([
      { id: "a", via: "text" },
      { id: "b", via: "text" },
    ]);
  });

  it("finds a video the words missed", () => {
    expect(fuseRankings([], ["x"])).toEqual([{ id: "x", via: "meaning" }]);
  });

  it("is deterministic on ties: the text ranking first", () => {
    expect(fuseRankings(["a"], ["b"]).map((f) => f.id)).toEqual(["a", "b"]);
  });
});

describe("VectorCache", () => {
  it("serves a vector until it expires, and keeps at most `max`", () => {
    let t = 0;
    const cache = new VectorCache(2, 1000, () => t);
    cache.set("a", { vector: [1], model: "m" });
    cache.set("b", { vector: [2], model: "m" });
    expect(cache.get("a")?.vector).toEqual([1]);
    cache.set("c", { vector: [3], model: "m" });
    expect(cache.get("b")).toBeNull();
    expect(cache.size).toBe(2);
    t = 1001;
    expect(cache.get("a")).toBeNull();
  });
});
