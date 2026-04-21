import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createRateLimiter } from "../src/lib/rateLimit.mts";

describe("createRateLimiter", () => {
  it("allows up to limit requests per key", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });

    assert.deepEqual(limiter.check("a"), { ok: true });
    assert.deepEqual(limiter.check("a"), { ok: true });
    assert.deepEqual(limiter.check("a"), { ok: true });
  });

  it("denies the (limit + 1)-th request with retryAfterSec > 0", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });

    limiter.check("a");
    limiter.check("a");
    const result = limiter.check("a");

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(
        result.retryAfterSec > 0,
        `expected positive retryAfterSec, got ${result.retryAfterSec}`,
      );
      assert.ok(result.retryAfterSec <= 60);
    }
  });

  it("treats keys independently", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });

    assert.deepEqual(limiter.check("a"), { ok: true });
    assert.deepEqual(limiter.check("b"), { ok: true });
    assert.equal(limiter.check("a").ok, false);
    assert.equal(limiter.check("b").ok, false);
  });

  it("resets the bucket once the window elapses", () => {
    let now = 1_000_000;
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 1000,
      now: () => now,
    });

    assert.deepEqual(limiter.check("a"), { ok: true });
    assert.equal(limiter.check("a").ok, false);

    now += 1001;
    assert.deepEqual(limiter.check("a"), { ok: true });
  });

  it("reset() clears all buckets", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });

    limiter.check("a");
    assert.equal(limiter.check("a").ok, false);

    limiter.reset();
    assert.deepEqual(limiter.check("a"), { ok: true });
  });
});
