import { describe, expect, it } from "vitest";

import { coverage, runStatus, shortRunId } from "./explorer-view";

describe("the Explorer view", () => {
  it("says what happened to a call, in words an operator acts on", () => {
    expect(runStatus("OK")).toEqual({ label: "Answered", tone: "success" });
    expect(runStatus("circuit_open")).toEqual({ label: "Paused after repeated failures", tone: "warning" });
    expect(runStatus("unreachable").tone).toBe("danger");
    expect(runStatus("something_new")).toEqual({ label: "something_new", tone: "danger" });
  });

  it("shortens a run id and says so when there is none", () => {
    expect(shortRunId("57f9c7f7-ded5-4778-8204-05a678296492")).toBe("57f9c7f7…");
    expect(shortRunId(null)).toBe("—");
  });

  it("measures how much of the public catalogue has a vector", () => {
    expect(coverage(0, 0)).toEqual({ percent: null, tone: "default" });
    expect(coverage(10, 10)).toEqual({ percent: 100, tone: "success" });
    expect(coverage(6, 10)).toEqual({ percent: 60, tone: "warning" });
    expect(coverage(1, 10)).toEqual({ percent: 10, tone: "danger" });
    expect(coverage(12, 10).percent).toBe(100);
  });
});
