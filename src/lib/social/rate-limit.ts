/**
 * Per-user in-memory sliding-window rate limiter (Task 50).
 *
 * ⚠️ NOTE: the store is per serverless INSTANCE. On Vercel each warm lambda
 * keeps its own map — this is a baseline guard against runaway loops/abuse,
 * not a hard global quota. A shared store (Upstash/Redis) is the future step
 * if stronger guarantees are needed.
 */

type Bucket = number[]; // timestamps of allowed hits

const store = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

/**
 * Returns true when the action is allowed. Records the hit either way.
 * @param key     stable per-user action key, e.g. `posts:create:<userId>`
 * @param limit   max hits in the window
 * @param windowMs sliding window size
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  // Opportunistic cleanup to keep memory bounded.
  if (store.size > MAX_KEYS) {
    for (const [k, v] of store) {
      if (v.every((t) => now - t > windowMs)) store.delete(k);
      if (store.size <= Math.floor(MAX_KEYS * 0.9)) break;
    }
  }
  const bucket = store.get(key) ?? [];
  const recent = bucket.filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    store.set(key, recent);
    return false;
  }
  recent.push(now);
  store.set(key, recent);
  return true;
}
