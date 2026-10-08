import { EventEmitter } from "events";
import { listenChannel, notifyChannel, type ChannelListener } from "@orochia/db";

/**
 * The realtime bus. Every event goes through PostgreSQL NOTIFY on one channel, and each app instance LISTENs and hands
 * it to the subscribers it holds (SSE streams) — so a bid, a message or a notification reaches its viewers whichever
 * instance served the action. No broker: the database the app already pays for does the fan-out.
 * Topics: `user:<id>` (one account's messages and notifications), `auction:<id>` (an auction's public feed).
 * While the LISTEN connection is down, events are delivered to this instance's subscribers directly.
 */

const CHANNEL = "orochia_events";

interface Bus {
  emitter: EventEmitter;
  listener: ChannelListener | null;
}

// One bus per process, kept across hot reloads in development.
const holder = globalThis as unknown as { __orochiaRealtime?: Bus };
function bus(): Bus {
  if (!holder.__orochiaRealtime) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    holder.__orochiaRealtime = { emitter, listener: null };
  }
  return holder.__orochiaRealtime;
}

function ensureListening(b: Bus) {
  if (b.listener) return;
  b.listener = listenChannel(CHANNEL, (payload) => {
    try {
      const { topic, event } = JSON.parse(payload) as { topic: string; event: unknown };
      b.emitter.emit(topic, event);
    } catch {
      /* not ours */
    }
  });
}

/** Subscribes to a topic on this instance; returns the unsubscribe function. */
export function subscribe<T = unknown>(topic: string, callback: (event: T) => void): () => void {
  const b = bus();
  ensureListening(b);
  b.emitter.on(topic, callback);
  return () => {
    b.emitter.off(topic, callback);
  };
}

/** Publishes an event to every instance's subscribers of the topic. Never throws: realtime is best-effort. */
export async function publish(topic: string, event: unknown): Promise<void> {
  const b = bus();
  if (!b.listener?.connected) {
    b.emitter.emit(topic, event);
    return;
  }
  try {
    await notifyChannel(CHANNEL, JSON.stringify({ topic, event }));
  } catch (error) {
    console.warn(`[realtime] publish ${topic} failed, delivered locally`, (error as Error).message);
    b.emitter.emit(topic, event);
  }
}

/**
 * A Server-Sent Events response fed by one or more topics: a `connected` event, then each event as a `data:` line,
 * a heartbeat every 15 s (proxies keep the connection), and the subscriptions dropped when the client goes away.
 */
export function sseResponse(topics: string[], initial?: unknown): Response {
  const encoder = new TextEncoder();
  const cleanups: (() => void)[] = [];
  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* closed by the client */
        }
      };
      send(`event: connected\ndata: ${JSON.stringify(initial ?? { status: "connected" })}\n\n`);
      for (const topic of topics) cleanups.push(subscribe(topic, (event) => send(`data: ${JSON.stringify(event)}\n\n`)));
      const heartbeat = setInterval(() => send(`: heartbeat\n\n`), 15_000);
      cleanups.push(() => clearInterval(heartbeat));
    },
    cancel() {
      for (const cleanup of cleanups) cleanup();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
