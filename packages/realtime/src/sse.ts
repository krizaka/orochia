/**
 * Server-Sent Events, framed by hand (the format is four fields). `eventStream` turns a few callbacks into a web
 * `Response` any runtime serves: heartbeats keep proxies from closing an idle stream, `retry` tells the browser how
 * fast to come back, and a maximum lifetime ends the stream cleanly before a platform's own request timeout does
 * (the client reconnects at once, with `Last-Event-ID`).
 */

export interface SseFrame {
  /** The event's id: the browser sends the last one back as `Last-Event-ID` when it reconnects. */
  id?: string;
  /** A named event (`addEventListener(name)`); absent: `message`. */
  event?: string;
  data?: unknown;
  /** Reconnection delay the client should use (ms). */
  retry?: number;
  /** A comment line (heartbeats). */
  comment?: string;
}

const clean = (value: string) => value.replace(/[\r\n]/g, " ");

export function sseFrame(frame: SseFrame): string {
  let out = "";
  if (frame.comment !== undefined) out += `: ${clean(frame.comment)}\n`;
  if (frame.retry !== undefined) out += `retry: ${Math.max(0, Math.round(frame.retry))}\n`;
  if (frame.id !== undefined) out += `id: ${clean(frame.id)}\n`;
  if (frame.event !== undefined) out += `event: ${clean(frame.event)}\n`;
  if (frame.data !== undefined) out += `data: ${JSON.stringify(frame.data)}\n`;
  return `${out}\n`;
}

export interface EventStreamControls {
  send(frame: SseFrame): void;
  /** Ends the stream from the server side (the client reconnects). */
  close(): void;
  /** Aborted when the client goes away or the stream ends. */
  signal: AbortSignal;
}

export interface EventStreamOptions {
  /** Runs once the stream is open; returns the cleanup to run when it ends. */
  start(controls: EventStreamControls): void | (() => void) | Promise<void | (() => void)>;
  /** Heartbeat period (ms) — below every proxy's idle timeout. */
  heartbeatMs?: number;
  /** Called at each heartbeat (presence refreshes its TTL there). */
  onHeartbeat?: () => void;
  /** Ends the stream after this long (ms, 0: never) — under a platform's hard request timeout. */
  maxLifetimeMs?: number;
  /** Reconnection delay sent to the client (ms). */
  retryMs?: number;
  headers?: Record<string, string>;
}

export function eventStream(options: EventStreamOptions): Response {
  const encoder = new TextEncoder();
  const abort = new AbortController();
  const cleanups: (() => void)[] = [];
  let ended = false;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;

  const end = () => {
    if (ended) return;
    ended = true;
    abort.abort();
    for (const cleanup of cleanups.splice(0).reverse()) {
      try {
        cleanup();
      } catch {
        /* keep cleaning */
      }
    }
    try {
      controllerRef?.close();
    } catch {
      /* already closed */
    }
  };

  const send = (frame: SseFrame) => {
    if (ended || !controllerRef) return;
    try {
      controllerRef.enqueue(encoder.encode(sseFrame(frame)));
    } catch {
      end();
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controllerRef = controller;
      if (options.retryMs) send({ retry: options.retryMs });
      const heartbeat = setInterval(() => {
        send({ comment: "heartbeat" });
        options.onHeartbeat?.();
      }, options.heartbeatMs ?? 15_000);
      cleanups.push(() => clearInterval(heartbeat));
      if (options.maxLifetimeMs) {
        const lifetime = setTimeout(end, options.maxLifetimeMs);
        cleanups.push(() => clearTimeout(lifetime));
      }
      try {
        const cleanup = await options.start({ send, close: end, signal: abort.signal });
        if (cleanup) {
          if (ended) cleanup();
          else cleanups.push(cleanup);
        }
      } catch (error) {
        console.warn("[realtime] stream start failed", (error as Error).message);
        end();
      }
    },
    cancel() {
      end();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...options.headers,
    },
  });
}
