/**
 * The pool and the LISTEN connection survive what a managed PostgreSQL does — failover, restart, maintenance — without
 * the process restarting (ORO-DBRECONNECT: dev.orochia.com stayed on 504 after the 16 → 18 upgrade until a redeploy).
 * Every connection goes through a small TCP proxy so the test can do to them what a managed service does: reset them,
 * stop answering (no RST — a dead peer), refuse them, and bring the database back. Runs when DB_IT=1 against the
 * PostgreSQL of DATABASE_URL (CI: the e2e job's service; locally: `npm run db:up`).
 */
import net from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Client } from "pg";

const enabled = process.env.DB_IT === "1";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const real = new URL(process.env.DATABASE_URL ?? "postgresql://orochia_user:orochia_secret@localhost:5432/orochia_db?sslmode=disable");

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

type Client_ = typeof import("./client");
const proxy = new FlakyProxy();

describe.skipIf(!enabled)("a database that drops its connections", { timeout: 30_000 }, () => {
  let db: Client_;

  beforeAll(async () => {
    await proxy.start();
    vi.stubEnv("DATABASE_URL", proxy.url());
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.resetModules();
    db = await import("./client");
  });

  afterEach(async () => {
    if (!proxy.port) await proxy.start();
  });

  afterAll(async () => {
    await db?.closeDb();
    await proxy.stop();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("serves the next query after the server reset every connection, without a new process", async () => {
    const pool = db.getPool();
    await Promise.all(Array.from({ length: 5 }, () => pool.query("select pg_sleep(0.2)"))); // five live connections
    expect(pool.totalCount).toBeGreaterThan(1);
    proxy.reset(); // the idle connections are now dead
    const start = Date.now();
    const { rows } = await pool.query("select 1 as ok");
    expect(rows[0].ok).toBe(1);
    expect(Date.now() - start).toBeLessThan(3000);
    expect(db.poolsCreated()).toBe(1);
    expect(await db.checkDbHealth()).toBe(true);
  });

  it("survives pg_terminate_backend on every connection of the pool (what the managed service does)", async () => {
    const pool = db.getPool();
    const pids = new Set<number>();
    await Promise.all(Array.from({ length: 5 }, () => pool.query("select pg_backend_pid() as pid, pg_sleep(0.2)").then((r) => pids.add(r.rows[0].pid))));
    const admin = new Client({ connectionString: real.toString() });
    await admin.connect();
    await admin.query("select pg_terminate_backend(pid) from unnest($1::int[]) as pid", [[...pids]]);
    await admin.end();
    const { rows } = await pool.query("select 1 as ok");
    expect(rows[0].ok).toBe(1);
    expect(await db.checkDbHealth()).toBe(true);
  });

  it("replays a read whose connection died under it, once, and never a write", async () => {
    const pool = db.getPool();
    await pool.query("select 1");
    const read = pool.query("select pg_sleep(0.6), 7 as seven");
    await sleep(150);
    proxy.reset();
    expect((await read).rows[0].seven).toBe(7);

    const write = pool.query("do $$ begin perform pg_sleep(0.6); end $$");
    await sleep(150);
    proxy.reset();
    await expect(write).rejects.toSatisfy((error) => db.isDatabaseUnavailable(error));
    expect((await pool.query("select 2 as two")).rows[0].two).toBe(2); // and the pool is fine afterwards
  });

  it("is down while the database is down, then healthy within seconds of its return — no restart", async () => {
    const pool = db.getPool();
    await pool.query("select 1");
    const { port } = proxy;
    await proxy.stop();
    expect(await db.checkDbHealth()).toBe(false);
    await expect(pool.query("select 1")).rejects.toSatisfy((error) => db.isDatabaseUnavailable(error));
    await proxy.start(port);
    const back = Date.now();
    expect(await until(() => db.checkDbHealth(), 5000)).toBe(true);
    expect(Date.now() - back).toBeLessThan(5000);
    expect(db.poolsCreated()).toBe(1);
  });

  it("gives up on a peer that went silent (no RST), destroys the connection and recovers", async () => {
    await db.closeDb(); // a client keeps the timeout it was created with: start from a fresh pool
    const pool = db.getPool();
    pool.options.query_timeout = 600;
    try {
      await pool.query("select 1");
      proxy.silence();
      // Every attempt hangs on a dead peer: the old pool waited forever and took the whole app down with it.
      const hung = Date.now();
      await expect(pool.query("select 1")).rejects.toSatisfy((error) => db.isDatabaseUnavailable(error));
      expect(Date.now() - hung).toBeLessThan(9000);
      expect(await db.checkDbHealth()).toBe(false);
      proxy.reset();
      await proxy.stop();
      await proxy.start(proxy.port);
      expect(await until(() => db.checkDbHealth(), 5000)).toBe(true);
    } finally {
      pool.options.query_timeout = db.QUERY_TIMEOUT_MS;
    }
  });
});

describe.skipIf(!enabled)("the LISTEN connection of the realtime bus", () => {
  it("reconnects and resubscribes after a reset, a stop and a silent drop", async () => {
    const flaky = new FlakyProxy();
    await flaky.start();
    vi.stubEnv("DATABASE_URL", flaky.url());
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.resetModules();
    const { listenChannel, notifyChannel } = await import("./listen");
    const { closeDb } = await import("./client");
    const channel = `it_reconnect_${Date.now()}`;
    const got: string[] = [];
    const listener = listenChannel(channel, (p) => got.push(p), undefined, { retryMs: 100, pingMs: 300, pingTimeoutMs: 400 });
    const delivered = async (payload: string) => {
      // Notify from a direct connection (the proxy's state does not matter to the publisher).
      const publisher = new Client({ connectionString: real.toString() });
      await publisher.connect();
      await publisher.query("select pg_notify($1, $2)", [channel, payload]);
      await publisher.end();
      return until(() => got.includes(payload), 4000);
    };
    try {
      expect(await until(() => listener.connected, 3000)).toBe(true);
      expect(await delivered("first")).toBe(true);

      flaky.reset(); // reset by the server
      expect(await until(() => !listener.connected, 1000)).toBe(true);
      expect(await until(() => listener.connected, 5000)).toBe(true);
      expect(await delivered("after-reset")).toBe(true);

      const { port } = flaky;
      await flaky.stop(); // database down
      expect(await until(() => !listener.connected, 1000)).toBe(true);
      await sleep(400);
      await flaky.start(port);
      expect(await until(() => listener.connected, 8000)).toBe(true);
      expect(await delivered("after-restart")).toBe(true);

      flaky.silence(); // gone without a word
      expect(await until(() => !listener.connected, 3000)).toBe(true);
      flaky.reset();
      await flaky.stop();
      await flaky.start(port);
      expect(await until(() => listener.connected, 8000)).toBe(true);
      expect(await delivered("after-silence")).toBe(true);
      expect(typeof notifyChannel).toBe("function");
    } finally {
      await listener.close();
      await closeDb();
      await flaky.stop();
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    }
  }, 60_000);
});
