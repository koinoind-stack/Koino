/**
 * Per-user / per-client in-memory sliding-window rate limiter (Task 50).
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

/**
 * Stable per-client identity for PUBLIC, unauthenticated endpoints (the
 * Bible reader). Preference order:
 *   1. `x-real-ip`      — set by the edge platform, not client-spoofable
 *   2. LAST `x-forwarded-for` hop — the connecting client as appended by
 *      the edge (earlier hops are client-controlled and must never be
 *      trusted for limiting, or rotating a fake first hop defeats the limiter)
 *   3. "unknown"        — local dev with no proxy; all such clients share
 *      one bucket (same property as the share-card route's guard)
 */
export function clientKeyFromRequest(req: Request): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((h) => h.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return "unknown";
}

/**
 * Per-client limiting for public endpoints: builds `<scope>:<clientKey>` and
 * applies the shared sliding window. FAIL-OPEN by design (same policy as the
 * groups route's rateLimitSafe): the limiter is an abuse guard and must never
 * break the reading path — worst case the window is skipped.
 */
export function rateLimitClient(
  req: Request,
  scope: string,
  limit: number,
  windowMs: number
): boolean {
  try {
    return rateLimit(`${scope}:${clientKeyFromRequest(req)}`, limit, windowMs);
  } catch {
    return true;
  }
}

/** Test hook: reset module state (mirrors the other __reset*ForTests hooks). */
export function __resetRateLimitForTests(): void {
  store.clear();
}
