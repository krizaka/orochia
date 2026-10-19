/**
 * A short-lived memory of each account's presence circle (krizaka/orochia#158). `presenceCircle` is a heavy query; a
 * mobile app that reconnects ten times in a few minutes would run it ten times and, with the other queries, exhaust the
 * connection pool. Here: one load per account per TTL, simultaneous callers share one load, a failure is not kept, and
 * a change of the circle (block, setting, contact) forgets the account at once.
 */
export interface CircleCache {
  get(userId: string): Promise<string[]>;
  invalidate(userId: string): void;
  /** Forgets the account's own circle and every cached circle that has it in it (it hid its presence, or left). */
  invalidateContaining(userId: string): void;
  size(): number;
}

export function createCircleCache({
  ttlMs,
  now = Date.now,
  load,
  max = 5000,
}: {
  ttlMs: number;
  now?: () => number;
  load: (userId: string) => Promise<string[]>;
  max?: number;
}): CircleCache {
  const done = new Map<string, { at: number; ids: string[] }>();
  const flying = new Map<string, Promise<string[]>>();
  return {
    async get(userId) {
      const hit = done.get(userId);
      if (hit && now() - hit.at < ttlMs) return hit.ids;
      const running = flying.get(userId);
      if (running) return running;
      const request = load(userId)
        .then((ids) => {
          done.delete(userId);
          done.set(userId, { at: now(), ids });
          // Oldest first out (Map keeps insertion order).
          while (done.size > max) done.delete(done.keys().next().value as string);
          return ids;
        })
        .finally(() => flying.delete(userId));
      flying.set(userId, request);
      return request;
    },
    invalidate(userId) {
      done.delete(userId);
      flying.delete(userId);
    },
    invalidateContaining(userId) {
      done.delete(userId);
      flying.delete(userId);
      for (const [id, entry] of done) if (entry.ids.includes(userId)) done.delete(id);
    },
    size: () => done.size,
  };
}

/**
 * Runs `fn` at once on the first call, then, if more calls came within `ms`, once more when the window ends (a burst of
 * `circle_changed` events rebuilds the circle at once and once after the burst — never a second late: the next
 * presence event of a new contact must be heard).
 */
export function trailing(fn: () => void, ms: number): (() => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending = false;
  const open = () => {
    timer = setTimeout(() => {
      timer = null;
      if (!pending) return;
      pending = false;
      fn();
      open();
    }, ms);
  };
  const call = () => {
    if (timer) {
      pending = true;
      return;
    }
    fn();
    open();
  };
  call.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = false;
  };
  return call;
}
