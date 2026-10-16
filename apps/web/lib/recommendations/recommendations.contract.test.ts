import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { toRecoItem } from "./recommendations.catalogue";
import { toErasure, toRecoEvent } from "./recommendations.events";
import { pseudonymOf } from "./recommendations.pseudonym";
import { CatalogueResultSchema, ErasureResultSchema, FeedSchema, IngestResultSchema, InsightsSchema, RecoEventKind, RecommendationSettingsSchema } from "./recommendations.types";

/**
 * The contract with Orazaka's recommender (ADR-078 §6): `recommendations-contract.json` is the file recorded in
 * krizaka/orazaka-knowledge-service (src/test/resources/contract/), kept identical. Orazaka's flow test sends its
 * requests and checks its live answers have the recorded shapes; here, what Orochia sends has the shape of the recorded
 * requests, and the recorded answers parse.
 */
const contract = JSON.parse(readFileSync(new URL("./recommendations-contract.json", import.meta.url), "utf8"));

const keysOf = (o: object) => Object.keys(o).sort();

describe("the recommendations contract", () => {
  it("sends events with exactly the recorded fields", () => {
    const recorded = contract.events.request.events[0];
    const sent = toRecoEvent({ accountId: "acc-1", videoId: "v-1", creatorId: "c-1", kind: RecoEventKind.Like, at: new Date("2026-10-15T12:00:00Z") }, "k".repeat(40));
    expect(keysOf(sent)).toEqual(keysOf(recorded));
    expect(sent.user).toMatch(/^[0-9a-f]{64}$/);
  });

  it("sends a follow without an item, as recorded", () => {
    const recorded = contract.events.request.events.find((e: { kind: string }) => e.kind === RecoEventKind.Follow);
    const sent = toRecoEvent({ accountId: "acc-1", videoId: "v-1", creatorId: "c-1", kind: RecoEventKind.Follow, at: new Date() }, "k".repeat(40));
    expect(sent.item).toBeNull();
    expect(recorded.item).toBeNull();
  });

  it("sends items and erasures with exactly the recorded fields", () => {
    const item = toRecoItem({ id: "v", creatorId: "c", title: "t", description: null, tags: null, durationSeconds: 0, createdAt: new Date() });
    expect(keysOf(item)).toEqual(keysOf(contract.items.request.items[0]));
    expect(keysOf(toErasure(["a"], ["v"], "k".repeat(40)))).toEqual(keysOf(contract.erasures.request));
  });

  it("parses every recorded answer", () => {
    expect(IngestResultSchema.parse(contract.events.response).accepted).toBe(3);
    expect(CatalogueResultSchema.parse(contract.items.response).embedded).toBe(2);
    expect(ErasureResultSchema.parse(contract.erasures.response).items).toBe(1);
    expect(FeedSchema.parse(contract.forYou.response).strategy).toBe("personal");
    expect(FeedSchema.parse(contract.similar.response).items[0].reasons).toEqual(["similar"]);
    expect(InsightsSchema.parse(contract.insights.response).tags[0].tag).toBe("jazz");
  });
});

describe("pseudonyms (Loi 25)", () => {
  it("are stable per account and key, never the id, and change with the key", () => {
    const key = "k".repeat(40);
    expect(pseudonymOf("acc-1", key)).toBe(pseudonymOf("acc-1", key));
    expect(pseudonymOf("acc-1", key)).not.toContain("acc-1");
    expect(pseudonymOf("acc-1", key)).not.toBe(pseudonymOf("acc-2", key));
    expect(pseudonymOf("acc-1", key)).not.toBe(pseudonymOf("acc-1", "j".repeat(40)));
  });
});

describe("the settings seeded by the migration", () => {
  it("are version 1 inside the bounds, switched off", () => {
    const sql = readFileSync(new URL("../../../../packages/db/drizzle/0012_recommendations.sql", import.meta.url), "utf8");
    const json = sql.slice(sql.indexOf("'{") + 1, sql.indexOf("}'") + 1);
    const settings = RecommendationSettingsSchema.parse(JSON.parse(json));
    expect(settings.enabled).toBe(false);
  });
});
