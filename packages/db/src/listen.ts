import { Client } from "pg";
import { connectionConfig } from "./connection";
import { directDatabaseUrl, getDb, isDatabaseUnavailable } from "./client";
import { sql } from "drizzle-orm";

/**
 * PostgreSQL LISTEN / NOTIFY — the realtime fan-out between app instances, with no broker to run or pay for.
 * `notifyChannel` publishes (inside a transaction, delivery happens at commit); `listenChannel` keeps one dedicated
 * connection listening and reconnects with a growing delay when it drops — one per process, because its only caller,
 * the realtime bus, is a process-wide singleton (apps/web/lib/realtime.ts). Payloads are at most ~8 KB: publish ids and
 * small facts, never documents. Needs a direct (session) connection — not a transaction pooler.
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

export interface ListenOptions {
  /** How often the LISTEN connection is checked with a round trip (default 20 s) — a silent drop emits no event. */
  pingMs?: number;
  /** How long a check may take before the connection is declared dead (default 5 s). */
  pingTimeoutMs?: number;
  /** First reconnection delay, doubled up to 30 s (default 1 s). */
  retryMs?: number;
}

export function listenChannel(channel: string, onMessage: (payload: string) => void, onState?: (connected: boolean) => void, options: ListenOptions = {}): ChannelListener {
  if (!/^[a-z_][a-z0-9_]*$/.test(channel)) throw new Error(`invalid channel name ${channel}`);
  let client: Client | null = null;
  let closed = false;
  let connected = false;
  const pingMs = options.pingMs ?? 20_000;
  const pingTimeoutMs = options.pingTimeoutMs ?? 5_000;
  const firstDelay = options.retryMs ?? 1000;
  let delay = firstDelay;
  let timer: NodeJS.Timeout | null = null;
  let pinger: NodeJS.Timeout | null = null;

  const setState = (value: boolean) => {
    if (connected === value) return;
    connected = value;
    onState?.(value);
  };

  const stopPinger = () => {
    if (pinger) clearInterval(pinger);
    pinger = null;
  };

  const retry = () => {
    setState(false);
    stopPinger();
    if (client) {
      client.removeAllListeners();
      // A dead socket may still emit "error" while it is torn down: without a listener that would crash the process.
      client.on("error", () => undefined);
      client.end().catch(() => undefined);
      // end() waits for a goodbye a silent peer never sends: drop the socket itself.
      (client as unknown as { connection?: { stream?: { destroy(): void } } }).connection?.stream?.destroy();
    }
    client = null;
    if (closed || timer) return;
    timer = setTimeout(() => {
      timer = null;
      void connect();
    }, delay);
    delay = Math.min(delay * 2, 30_000);
  };

  const connect = async () => {
    let next: Client;
    try {
      next = new Client({ ...connectionConfig(directDatabaseUrl()), application_name: "orochia-listen", keepAlive: true, keepAliveInitialDelayMillis: 10_000, connectionTimeoutMillis: 5_000 });
    } catch (error) {
      console.warn(`[listen] ${channel}: ${(error as Error).message}`);
      return retry();
    }
    client = next;
    next.on("error", retry);
    next.on("end", retry);
    next.on("notification", (msg) => {
      if (msg.channel === channel && msg.payload) onMessage(msg.payload);
    });
    try {
      await next.connect();
      await next.query(`LISTEN ${channel}`);
      delay = firstDelay;
      setState(true);
      // A connection that went silent (failover without a reset, a firewall dropping the flow) emits nothing: ask it.
      pinger = setInterval(() => {
        if (client !== next) return;
        let answered = false;
        const deadline = setTimeout(() => {
          if (answered || client !== next) return;
          console.warn(`[listen] ${channel}: no answer in ${Math.round(pingTimeoutMs / 1000)} s — reconnecting`);
          retry();
        }, pingTimeoutMs);
        next.query("SELECT 1").then(
          () => {
            answered = true;
            clearTimeout(deadline);
          },
          () => {
            answered = true;
            clearTimeout(deadline);
            if (client === next) retry();
          },
        );
      }, pingMs);
      pinger.unref?.();
    } catch (error) {
      const reason = isDatabaseUnavailable(error) ? `database unavailable (${(error as { code?: string }).code ?? "error"})` : (error as Error).message;
      console.warn(`[listen] ${channel}: ${reason} — retrying in ${Math.round(delay / 1000)} s`);
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
      stopPinger();
      if (timer) clearTimeout(timer);
      setState(false);
      await client?.end().catch(() => undefined);
    },
  };
}
