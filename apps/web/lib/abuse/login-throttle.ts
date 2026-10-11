import { enforceRateLimit,RateLimitError, rateLimitStore } from "../rate-limit";

/**
 * Sign-in brute force: progressive back-off, then a temporary lock-out — per identifier (the e-mail or username typed,
 * existing or not, so the answer never tells whether an account exists) — and a ceiling per IP address.
 *
 * - The first {@link FREE_FAILURES} wrong passwords in {@link FAILURE_WINDOW_SECONDS} cost nothing.
 * - Each failure after that locks the identifier for 30 s, 60 s, 2 min, 4 min… up to {@link MAX_LOCK_SECONDS}
 *   (15 min): a person who mistyped waits seconds, a guesser gets a handful of tries an hour.
 * - A successful sign-in clears the failures.
 * Answers are 429 `LOGIN_LOCKED` with `Retry-After`. Counters live in the shared rate-limit store.
 */
export const FREE_FAILURES = 5;
export const FAILURE_WINDOW_SECONDS = 60 * 60;
export const MAX_LOCK_SECONDS = 15 * 60;

/** Seconds of lock-out after this many failures in the window (0: none yet). */
export function lockoutSeconds(failures: number): number {
  if (failures <= FREE_FAILURES) return 0;
  return Math.min(MAX_LOCK_SECONDS, 30 * 2 ** (failures - FREE_FAILURES - 1));
}

const failuresKey = (identifier: string) => `login-fail:${identifier.toLowerCase().slice(0, 150)}`;
const lockKey = (identifier: string) => `login-lock:${identifier.toLowerCase().slice(0, 150)}`;

/** Before checking the password: refuses an IP over its ceiling or an identifier still locked. */
export async function assertLoginAllowed(identifier: string, ip: string) {
  await enforceRateLimit(`login-ip:${ip}`, 50, 15 * 60, "Too many sign-in attempts from this network. Try again later.", "LOGIN_RATE_LIMITED");
  try {
    const lock = await rateLimitStore().peek(lockKey(identifier));
    if (lock) throw new RateLimitError("Too many failed attempts. Wait a moment, then try again.", (lock.resetAt - Date.now()) / 1000, "LOGIN_LOCKED");
  } catch (error) {
    if (error instanceof RateLimitError) throw error;
    console.error("login-throttle: store failed — attempt allowed", error);
  }
}

/** After a wrong password: counts it and, past the free failures, locks the identifier. Returns the lock (s). */
export async function recordLoginFailure(identifier: string): Promise<number> {
  try {
    const store = rateLimitStore();
    const { count } = await store.hit(failuresKey(identifier), FAILURE_WINDOW_SECONDS);
    const seconds = lockoutSeconds(count);
    if (seconds > 0) await store.set(lockKey(identifier), count, seconds);
    return seconds;
  } catch (error) {
    console.error("login-throttle: could not record a failure", error);
    return 0;
  }
}

/** After a successful sign-in: the slate is clean. */
export async function clearLoginFailures(identifier: string) {
  try {
    const store = rateLimitStore();
    await Promise.all([store.reset(failuresKey(identifier)), store.reset(lockKey(identifier))]);
  } catch (error) {
    console.error("login-throttle: could not clear failures", error);
  }
}
