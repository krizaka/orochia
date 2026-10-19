/**
 * The console's pool survives what a managed PostgreSQL does — failover, restart, maintenance — without the process
 * restarting (ORO-DBRECONNECT, as on Orochia). Every connection goes through a small TCP proxy so the test can reset
 * them, silence them (a peer that vanished without a RST) and refuse them. Runs when DATABASE_RECONNECT_IT=1 against
 * the PostgreSQL of DATABASE_CONSOLE_URL (CI: a service container).
 */
import net from "node:net";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const enabled = process.env.DATABASE_RECONNECT_IT === "1";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const real = new URL(process.env.DATABASE_CONSOLE_URL ?? "postgresql://orochia_user:orochia_secret@localhost:5432/orochia_db?sslmode=disable");

async function until(check: () => boolean | Promise<boolean>, ms: number) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await check()) return true;
    await sleep(25);
  }
  return false;
}

/** A TCP proxy in front of the real database that can reset, silence or refuse connections. */
class FlakyProxy {
  private server: net.Server | null = null;
  private sockets = new Set<net.Socket>();
  private silent = false;
  port = 0;

  async start(port = 0) {
    this.silent = false;
    this.server = net.createServer((client) => {
      const upstream = net.connect(Number(real.port || 5432), real.hostname);
      this.sockets.add(client).add(upstream);
      const forget = () => {
        this.sockets.delete(client);
        this.sockets.delete(upstream);
        client.destroy();
        upstream.destroy();
      };
      client.on("data", (d) => !this.silent && upstream.write(d));
      upstream.on("data", (d) => !this.silent && client.write(d));
      client.on("error", forget).on("close", forget);
      upstream.on("error", forget).on("close", forget);
    });
    await new Promise<void>((resolve) => this.server!.listen(port, "127.0.0.1", resolve));
    this.port = (this.server.address() as net.AddressInfo).port;
  }

  /** The server drops every connection (RST), as on a failover. */
  reset() {
    for (const s of this.sockets) s.resetAndDestroy?.() ?? s.destroy();
    this.sockets.clear();
  }

  /** Connections stay open but nothing is forwarded any more: a peer that vanished without a RST. */
  silence() {
    this.silent = true;
  }

  /** The database is down: connections are reset and new ones refused. */
  async stop() {
    this.reset();
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
    this.server = null;
  }

  url() {
    const url = new URL(real.toString());
    url.hostname = "127.0.0.1";
    url.port = String(this.port);
    return url.toString();
  }
}

const proxy = new FlakyProxy();

describe.skipIf(!enabled)("the console's pool when the database drops its connections", { timeout: 30_000 }, () => {
  let db: typeof import("./db");

  beforeAll(async () => {
    await proxy.start();
    vi.stubEnv("DATABASE_CONSOLE_URL", proxy.url());
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.resetModules();
    db = await import("./db");
  });

  afterAll(async () => {
    await db?.closeDb();
    await proxy.stop();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("serves the next query after the server reset every connection", async () => {
    await Promise.all(Array.from({ length: 5 }, () => db.sql("select pg_sleep(0.2)")));
    proxy.reset();
    expect((await db.sql<{ ok: number }>("select 1 as ok"))[0].ok).toBe(1);
  });

  it("replays a read whose connection died under it, once, and never a write", async () => {
    const read = db.sql<{ seven: number }>("select pg_sleep(0.6), 7 as seven");
    await sleep(150);
    proxy.reset();
    expect((await read)[0].seven).toBe(7);

    const write = db.sql("do $$ begin perform pg_sleep(0.6); end $$");
    await sleep(150);
    proxy.reset();
    await expect(write).rejects.toSatisfy((error) => db.isDatabaseUnavailable(error));
    expect((await db.sql<{ two: number }>("select 2 as two"))[0].two).toBe(2);
  });

  it("recovers when the database comes back after an outage", async () => {
    const { port } = proxy;
    await proxy.stop();
    await expect(db.sql("select 1")).rejects.toSatisfy((error) => db.isDatabaseUnavailable(error));
    await proxy.start(port);
    expect(await until(() => db.sql("select 1").then(() => true, () => false), 5000)).toBe(true);
  });

  it("gives up on a silent peer instead of hanging, then recovers", async () => {
    await db.closeDb(); // a client keeps the timeout it was created with: start from a fresh pool
    db.pool().options.query_timeout = 600;
    await db.sql("select 1");
    proxy.silence();
    const hung = Date.now();
    await expect(db.sql("select 1")).rejects.toSatisfy((error) => db.isDatabaseUnavailable(error));
    expect(Date.now() - hung).toBeLessThan(9000);
    const { port } = proxy;
    await proxy.stop();
    await proxy.start(port);
    expect(await until(() => db.sql("select 1").then(() => true, () => false), 6000)).toBe(true);
  });
});
