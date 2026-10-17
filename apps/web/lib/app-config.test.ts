import { type AppConfigRecord, defaultRecord } from "@krizaka/app-config";
import { createAppConfigHandler, memoryStore } from "@krizaka/app-config/server";
import { describe, expect, it } from "vitest";

import { recordOf } from "./app-config";

const record = (patch: Partial<AppConfigRecord>): AppConfigRecord => ({ ...defaultRecord("ios"), ...patch });
const ask = (store: ReturnType<typeof memoryStore>, version: string) =>
  createAppConfigHandler({ store })(new Request(`https://x.test/api/v1/app-config?platform=ios&version=${version}`)).then((r) => r.json());

describe("the app-config endpoint", () => {
  it("forces the update when the minimum is above the app's version", async () => {
    const store = memoryStore([record({ minSupportedVersion: "1.2.0", latestVersion: "1.3.0" })]);
    expect((await ask(store, "1.1.0")).updateMode).toBe("force");
    expect((await ask(store, "1.2.0")).updateMode).not.toBe("force");
  });

  it("blocks nobody with the seeded values", async () => {
    expect((await ask(memoryStore([record({})]), "0.0.1")).updateMode).toBe("none");
  });

  it("reads a database row as the contract's record", () => {
    const at = new Date("2026-10-17T12:00:00Z");
    const r = recordOf({
      platform: "ios", minSupportedVersion: "1.0.0", latestVersion: "1.1.0", updateOverride: null, storeUrl: null,
      maintenanceOn: false, maintenanceMessage: {}, message: { fr: "Mettez à jour" }, contractMin: 1, contractMax: 1,
      contractSunset: null, flags: {}, revision: 2, updatedAt: at, updatedBy: "seed",
    });
    expect(r.updatedAt).toBe("2026-10-17T12:00:00.000Z");
    expect(r.message.fr).toBe("Mettez à jour");
  });
});
