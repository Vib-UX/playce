/**
 * Shared Redis client + tiny JSON helpers for Playce's server-side stores.
 *
 * The chess registry, stake registry and leaderboard all started life as
 * process-local maps that reset on every restart (fine for a single long-lived
 * Node process, fatal on a platform like Railway that redeploys/restarts). This
 * module gives those stores a durable backing without changing their mostly
 * synchronous surface: they keep an in-memory map as the hot path, write through
 * to Redis on every mutation, and re-hydrate the map from Redis on boot.
 *
 * If `REDIS_URL` is not set the client is null and the stores stay purely
 * in-memory — preserving the previous behaviour for local dev.
 */
import Redis from "ioredis";

const CLIENT_KEY = "__playce_redis_client__";
let warnedMissing = false;

/** Lazily create (once) and return the shared ioredis client, or null. */
export function getRedis() {
  const url = process.env.REDIS_URL;
  if (!url) {
    if (!warnedMissing) {
      console.warn("[redis] REDIS_URL not set — server stores are in-memory only.");
      warnedMissing = true;
    }
    return null;
  }
  if (!globalThis[CLIENT_KEY]) {
    const client = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: true,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });
    client.on("error", (err) => {
      console.error("[redis] connection error:", err?.message ?? err);
    });
    client.on("connect", () => console.log("[redis] connected."));
    globalThis[CLIENT_KEY] = client;
  }
  return globalThis[CLIENT_KEY];
}

/**
 * Read a JSON value from Redis. Returns `fallback` when Redis is unavailable,
 * the key is empty, or the payload can't be parsed.
 * @template T
 * @param {string} key
 * @param {T} [fallback]
 * @returns {Promise<T | null>}
 */
export async function loadJSON(key, fallback = null) {
  const redis = getRedis();
  if (!redis) return fallback;
  try {
    const raw = await redis.get(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[redis] loadJSON(${key}) failed:`, err?.message ?? err);
    return fallback;
  }
}

/**
 * Write-through a JSON value to Redis (fire-and-forget). Never throws — a Redis
 * hiccup must not break the request path. Refreshes a long TTL so abandoned
 * rooms self-expire.
 * @param {string} key
 * @param {unknown} value
 * @param {number} [ttlSeconds] default 30 days
 */
export function saveJSON(key, value, ttlSeconds = 60 * 60 * 24 * 30) {
  const redis = getRedis();
  if (!redis) return;
  let payload;
  try {
    payload = JSON.stringify(value);
  } catch (err) {
    console.error(`[redis] saveJSON(${key}) serialize failed:`, err?.message ?? err);
    return;
  }
  redis
    .set(key, payload, "EX", ttlSeconds)
    .catch((err) => console.error(`[redis] saveJSON(${key}) failed:`, err?.message ?? err));
}
