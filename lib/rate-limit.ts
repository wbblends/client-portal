/**
 * Tiny in-memory token-bucket rate limiter. Keyed by an opaque string (e.g.
 * client IP + route). Survives only as long as the JS instance — on serverless
 * platforms a determined attacker can churn cold-starts to reset the counter,
 * so this is one layer in defense-in-depth, not a substitute for a real
 * upstream WAF / CDN bot rules.
 */

type Bucket = { tokens: number; updatedAt: number };

const BUCKETS = new Map<string, Bucket>();
const SWEEP_AFTER_MS = 10 * 60 * 1000;
let lastSweep = Date.now();

export type RateLimitResult = {
  allowed: boolean;
  /** Tokens left after this attempt (>= 0). */
  remaining: number;
  /** When (ms epoch) the bucket will fully refill. */
  resetAt: number;
};

/**
 * @param key      stable identifier for the client (e.g. `"login:1.2.3.4"`)
 * @param capacity max attempts in the window
 * @param windowMs window length used to compute the refill rate
 */
export function consume(key: string, capacity: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (now - lastSweep > SWEEP_AFTER_MS) sweep(now);

  const refillPerMs = capacity / windowMs;
  const bucket = BUCKETS.get(key);
  if (!bucket) {
    BUCKETS.set(key, { tokens: capacity - 1, updatedAt: now });
    return { allowed: true, remaining: capacity - 1, resetAt: now + windowMs };
  }

  const elapsed = now - bucket.updatedAt;
  const refilled = Math.min(capacity, bucket.tokens + elapsed * refillPerMs);
  if (refilled < 1) {
    bucket.tokens = refilled;
    bucket.updatedAt = now;
    const msUntilOne = (1 - refilled) / refillPerMs;
    return { allowed: false, remaining: 0, resetAt: now + msUntilOne };
  }
  bucket.tokens = refilled - 1;
  bucket.updatedAt = now;
  return { allowed: true, remaining: Math.floor(bucket.tokens), resetAt: now + windowMs };
}

function sweep(now: number) {
  for (const [key, bucket] of BUCKETS) {
    if (now - bucket.updatedAt > SWEEP_AFTER_MS) BUCKETS.delete(key);
  }
  lastSweep = now;
}

/** Best-effort client IP extraction for rate-limit keys. Not for auth. */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? "unknown";
}
