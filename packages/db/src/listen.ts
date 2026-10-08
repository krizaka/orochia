import { Client } from "pg";
import { connectionConfig } from "./connection";
import { getDb } from "./client";
import { sql } from "drizzle-orm";

/**
 * PostgreSQL LISTEN / NOTIFY — the realtime fan-out between app instances, with no broker to run or pay for.
 * `notifyChannel` publishes (inside a transaction, delivery happens at commit); `listenChannel` keeps one dedicated
 * connection per process listening and reconnects with a growing delay when it drops. Payloads are at most ~8 KB:
 * publish ids and small facts, never documents. Needs a direct (session) connection — not a transaction pooler.
 */

export const NOTIFY_PAYLOAD_LIMIT = 7900;

export async function notifyChannel(channel: string, payload: string): Promise<void> {
  if (Buffer.byteLength(payload) > NOTIFY_PAYLOAD_LIMIT) throw new Error(`notify payload too large (${channel})`);
  await getDb().execute(sql`select pg_notify(${channel}, ${payload})`);
}

export interface ChannelListener {
  /** True while the LISTEN connection is up (events published elsewhere arrive). */
  readonly connected: boolean;
  close(): Promise<void>;
}

export function listenChannel(channel: string, onMessage: (payload: string) => void, onState?: (connected: boolean) => void): ChannelListener {
  if (!/^[a-z_][a-z0-9_]*$/.test(channel)) throw new Error(`invalid channel name ${channel}`);
  let client: Client | null = null;
  let closed = false;
  let connected = false;
  let delay = 1000;
  let timer: NodeJS.Timeout | null = null;

  const setState = (value: boolean) => {
    if (connected === value) return;
    connected = value;
    onState?.(value);
  };

  const retry = () => {
    setState(false);
    client?.removeAllListeners();
    client?.end().catch(() => undefined);
    client = null;
    if (closed || timer) return;
    timer = setTimeout(() => {
      timer = null;
      void connect();
    }, delay);
    delay = Math.min(delay * 2, 30_000);
  };

  const connect = async () => {
    const url = process.env.DATABASE_URL?.trim() || "postgresql://orochia_user:orochia_secret@localhost:5432/orochia_db?sslmode=disable";
    const next = new Client(connectionConfig(url));
    client = next;
    next.on("error", retry);
    next.on("end", retry);
    next.on("notification", (msg) => {
      if (msg.channel === channel && msg.payload) onMessage(msg.payload);
    });
    try {
      await next.connect();
      await next.query(`LISTEN ${channel}`);
      delay = 1000;
      setState(true);
    } catch (error) {
      console.warn(`[listen] ${channel}: ${(error as Error).message}`);
      retry();
    }
  };

  void connect();
  return {
    get connected() {
      return connected;
    },
    async close() {
      closed = true;
      if (timer) clearTimeout(timer);
      setState(false);
      await client?.end().catch(() => undefined);
    },
  };
}
