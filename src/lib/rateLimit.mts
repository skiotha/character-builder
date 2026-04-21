export interface RateLimitOk {
  ok: true;
}

export interface RateLimitDenied {
  ok: false;
  retryAfterSec: number;
}

export type RateLimitResult = RateLimitOk | RateLimitDenied;

export interface RateLimiter {
  check(key: string): RateLimitResult;
  reset(): void;
}

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  /** Override the clock (testing only). */
  now?: () => number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { limit, windowMs } = options;
  const now = options.now ?? Date.now;
  const buckets = new Map<string, Bucket>();

  return {
    check(key: string): RateLimitResult {
      const t = now();
      const bucket = buckets.get(key);

      if (!bucket || t >= bucket.resetAt) {
        buckets.set(key, { count: 1, resetAt: t + windowMs });
        return { ok: true };
      }

      bucket.count += 1;

      if (bucket.count > limit) {
        return {
          ok: false,
          retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - t) / 1000)),
        };
      }

      return { ok: true };
    },
    reset(): void {
      buckets.clear();
    },
  };
}
