import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { InsightsSchema } from "./recommendations.types";
import { describeInsights, InsightsStatus } from "./recommendations.view";

const contract = JSON.parse(readFileSync(new URL("./recommendations-contract.json", import.meta.url), "utf8"));

describe("creator insights", () => {
  it("draws the recorded answer: own videos with their titles, rates as percentages", () => {
    const data = InsightsSchema.parse(contract.insights.response);
    const view = describeInsights(data, new Map([[data.items[0].itemId, "Late-night jazz trio"]]), "req-1");
    expect(view).toMatchObject({ status: "ok", requestId: "req-1", minAudience: 3, alsoWatchedCount: 1 });
    if (view.status !== InsightsStatus.Ok) throw new Error("ok expected");
    expect(view.videos[0]).toMatchObject({ title: "Late-night jazz trio", ratePct: 100, avgWatchedPct: 80 });
    expect(view.tags[0]).toMatchObject({ tag: "jazz", ratePct: 100 });
  });

  it("drops what Orochia does not know as the creator's (deleted, or not theirs), and never names other creators", () => {
    const data = InsightsSchema.parse(contract.insights.response);
    const view = describeInsights(data, new Map(), null);
    if (view.status !== InsightsStatus.Ok) throw new Error("ok expected");
    expect(view.videos).toEqual([]);
    expect(JSON.stringify(view)).not.toContain(data.alsoWatched[0].creatorId);
  });
});
