import { describe, expect, it } from "vitest";

import { parseCursor } from "./chat-stream";

describe("the stream's resume cursor", () => {
  it("reads Last-Event-ID (m<seq>) and ?after=<seq>, ignores anything else", () => {
    expect(parseCursor("m42")).toBe(42);
    expect(parseCursor("42")).toBe(42);
    expect(parseCursor(" m7 ")).toBe(7);
    expect(parseCursor("garbage")).toBeNull();
    expect(parseCursor("m-1")).toBeNull();
    expect(parseCursor(null)).toBeNull();
  });
});
