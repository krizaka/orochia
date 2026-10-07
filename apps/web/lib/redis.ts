import Redis from "ioredis";

let redisClient: Redis | null = null;

export function getRedis(): Redis | null {
  if (redisClient) return redisClient;

  // Redis is optional in production: without REDIS_URL there is no client (limits fail open, no cache).
  if (!process.env.REDIS_URL && process.env.NODE_ENV === "production") return null;
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  try {
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    redisClient.on("error", (err) => {
      // Suppress noisy logs in dev when redis is optionally offline
      if (process.env.NODE_ENV === "production") {
        console.error("Redis connection error:", err);
      }
    });

    return redisClient;
  } catch (err) {
    console.warn("Failed to instantiate Redis client:", err);
    return null;
  }
}

/**
 * Checks Redis health.
 */
export async function checkRedisHealth(): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;
  try {
    if (client.status !== "ready") {
      await client.connect();
    }
    const pong = await client.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

/**
 * Sliding window rate limiter for abuse prevention on video uploads and payments.
 */
export async function checkRateLimit(
  identifier: string,
  limit = 20,
  windowSeconds = 60
): Promise<{ success: boolean; remaining: number }> {
  const client = getRedis();
  if (!client) {
    // If Redis is not reachable, gracefully allow in dev
    return { success: true, remaining: limit - 1 };
  }

  try {
    if (client.status !== "ready") {
      await client.connect();
    }
    const key = `rate_limit:${identifier}`;
    const current = await client.incr(key);

    if (current === 1) {
      await client.expire(key, windowSeconds);
    }

    const remaining = Math.max(0, limit - current);
    return {
      success: current <= limit,
      remaining,
    };
  } catch (error) {
    console.warn("Rate limit check failed, allowing request:", error);
    return { success: true, remaining: limit - 1 };
  }
}

/**
 * Cached feed retrieval with TTL.
 */
export async function getCachedJson<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    if (client.status !== "ready") {
      await client.connect();
    }
    const raw = await client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function setCachedJson(key: string, data: unknown, ttlSeconds = 120): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    if (client.status !== "ready") {
      await client.connect();
    }
    await client.setex(key, ttlSeconds, JSON.stringify(data));
  } catch {
    // Graceful fallback
  }
}
