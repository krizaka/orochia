/**
 * Orochia's realtime wiring against real servers: @krizaka/realtime's buses on Orochia's own LISTEN/NOTIFY primitives
 * (packages/db/src/listen.ts) and on Redis / Valkey, two buses in one process standing for two app instances. The
 * adapters themselves are tested in krizaka-ui; this proves the connection Orochia hands them.
 * Runs when REALTIME_IT=1: PostgreSQL from DATABASE_URL, Redis / Valkey from REDIS_URL (CI: the e2e job's services;
 * locally: `docker run -p 6390:6379 valkey/valkey:8-alpine`, REDIS_URL=redis://localhost:6390).
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { postgresBus, type RealtimeBus } from "@krizaka/realtime";
import { redisBus } from "@krizaka/realtime/redis";

const enabled = process.env.REALTIME_IT === "1";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until(check: () => boolean | Promise<boolean>, ms = 3000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await check()) return true;
    await sleep(20);
  }
  return false;
}

function contract(name: string, make: () => Promise<[RealtimeBus, RealtimeBus]>) {
  describe.skipIf(!enabled)(`${name} bus — two instances`, () => {
    let a: RealtimeBus, b: RealtimeBus;
    afterAll(async () => {
      await a?.close();
      await b?.close();
    });

    it("connects", async () => {
      [a, b] = await make();
      expect(await until(() => a.connected && b.connected, 5000)).toBe(true);
    });

    it("an event published on one instance reaches the other's subscriber in under a second", async () => {
      const channel = `user:${randomUUID()}`;
      const got: { sentAt: number }[] = [];
      const off = b.subscribe(channel, (e) => got.push(e as { sentAt: number }));
      await sleep(100); // the subscription reaches the server
      const sentAt = Date.now();
      await a.publish(channel, { sentAt });
      expect(await until(() => got.length === 1, 1000)).toBe(true);
      expect(Date.now() - sentAt).toBeLessThan(1000);
      off();
      await sleep(100);
      await a.publish(channel, { sentAt: 0 });
      await sleep(200);
      expect(got).toHaveLength(1);
    });

    it("keeps the order of a burst on one channel", async () => {
      const channel = `user:${randomUUID()}`;
      const got: number[] = [];
      b.subscribe(channel, (e) => got.push(e as number));
      await sleep(100);
      for (let i = 0; i < 50; i++) await a.publish(channel, i);
      expect(await until(() => got.length === 50)).toBe(true);
      expect(got).toEqual([...Array(50).keys()]);
    });

    it("presence seen from both instances, announced once, offline after the grace", async () => {
      const user = randomUUID();
      const discovered: unknown[] = [];
      a.presence.onChange((c) => c.userId === user && discovered.push(c));
      b.presence.onChange((c) => c.userId === user && discovered.push(c));
      const changes = [await a.presence.beat(user, "tab", "online")];
      expect(changes[0]).toMatchObject({ state: "online" });
      expect(await until(async () => (await b.presence.get([user])).get(user)?.state === "online")).toBe(true);
      expect(await b.presence.beat(user, "phone", "online")).toBeNull();
      await a.presence.leave(user, "tab");
      await b.presence.leave(user, "phone");
      await sleep(400); // the grace of these buses
      const settled: unknown[] = [await a.presence.settle(user), await b.presence.settle(user)].filter(Boolean);
      await sleep(300); // a report from the other instance may be what reveals it
      settled.push(...discovered);
      expect(settled).toHaveLength(1);
      expect(settled[0]).toMatchObject({ state: "offline" });
      expect(await until(async () => (await a.presence.get([user])).get(user)?.state === "offline")).toBe(true);
      expect((await a.presence.get([user])).get(user)?.lastSeenAt).toBeGreaterThan(Date.now() - 5000);
    });
  });
}

contract("postgres", async () => {
  const { listenChannel, notifyChannel } = await import("@orochia/db");
  const channel = `rt_it_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const db = { listen: listenChannel, notify: notifyChannel };
  return [postgresBus({ db, channel, graceMs: 300 }), postgresBus({ db, channel, graceMs: 300 })];
});

contract("redis", async () => {
  const url = process.env.REDIS_URL ?? "redis://localhost:6390";
  const prefix = `it:${randomUUID()}:`;
  return [redisBus({ url, prefix, graceMs: 300 }), redisBus({ url, prefix, graceMs: 300 })];
});

describe.skipIf(!enabled)("postgres bus — a fresh instance", () => {
  it("an instance that has just started (its LISTEN not up yet) still reaches the others", async () => {
    const { listenChannel, notifyChannel } = await import("@orochia/db");
    const channel = `rt_it_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const db = { listen: listenChannel, notify: notifyChannel };
    const listening = postgresBus({ db, channel });
    expect(await until(() => listening.connected, 5000)).toBe(true);
    const got: unknown[] = [];
    listening.subscribe("user:x", (e) => got.push(e));
    const fresh = postgresBus({ db, channel });
    await fresh.publish("user:x", { first: true }); // before its own LISTEN is connected
    expect(await until(() => got.length === 1, 2000)).toBe(true);
    await fresh.close();
    await listening.close();
  });
});
