/**
 * Fixed-window rate limiter for abuse prevention (sign-in, uploads, payments…).
 * In memory, per instance: counters reset on restart and are not shared between instances.
 * Good enough for a single-instance deployment; move to a shared store before scaling out.
 */
const windows = new Map<string, { count: number; resetAt: number }>();
const MAX_KEYS = 10_000;

export async function checkRateLimit(
  identifier: string,
  limit = 20,
  windowSeconds = 60
): Promise<{ success: boolean; remaining: number }> {
  const now = Date.now();
  let entry = windows.get(identifier);
  if (!entry || entry.resetAt <= now) {
    if (windows.size >= MAX_KEYS) {
      for (const [key, value] of windows) if (value.resetAt <= now) windows.delete(key);
      if (windows.size >= MAX_KEYS) windows.clear();
    }
    entry = { count: 0, resetAt: now + windowSeconds * 1000 };
    windows.set(identifier, entry);
  }
  entry.count += 1;
  return { success: entry.count <= limit, remaining: Math.max(0, limit - entry.count) };
}
