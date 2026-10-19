/**
 * A short memory of what a load answered (ORO-PERF): one load per key per TTL, simultaneous callers share one load, a
 * failure is not kept, and neither is an answer the caller calls incomplete (`keep`: a section that could not load).
 * In-process only — each instance asks the database at most once per TTL for what every visitor sees.
 */
export interface TtlMemo<T> {
  get(key: string, load: () => Promise<T>): Promise<T>;
  forget(key: string): void;
  size(): number;
}

export function createTtlMemo<T>({ ttlMs, now = Date.now, max = 50, keep = () => true }: { ttlMs: number; now?: () => number; max?: number; keep?: (value: T) => boolean }): TtlMemo<T> {
  const done = new Map<string, { at: number; value: T }>();
  const flying = new Map<string, Promise<T>>();
  return {
    async get(key, load) {
      const hit = done.get(key);
      if (hit && now() - hit.at < ttlMs) return hit.value;
      const running = flying.get(key);
      if (running) return running;
      const request = load()
        .then((value) => {
          done.delete(key);
          if (keep(value)) {
            done.set(key, { at: now(), value });
            while (done.size > max) done.delete(done.keys().next().value as string);
          }
          return value;
        })
        .finally(() => flying.delete(key));
      flying.set(key, request);
      return request;
    },
    forget(key) {
      done.delete(key);
      flying.delete(key);
    },
    size: () => done.size,
  };
}
