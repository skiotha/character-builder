import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

import type { NagaraRequest } from "#types";

// ── Setup: mock #config before importing #auth ────────────────────

const TEST_TOKEN = "test-secret-token-abc123";

const configMock = mock.module("#config", {
  namedExports: { DM_TOKEN: TEST_TOKEN },
});
const { validateDmToken, requireDmToken } = await import("#auth");

// ── helpers ───────────────────────────────────────────────────────

function makeRequest(dmId?: string | string[]): NagaraRequest {
  const headers: Record<string, string | string[] | undefined> = {};
  if (dmId !== undefined) headers["x-dm-id"] = dmId;
  return { headers } as unknown as NagaraRequest;
}

// ── validateDmToken ───────────────────────────────────────────────

describe("validateDmToken", () => {
  it("returns true for correct token", () => {
    assert.equal(validateDmToken(TEST_TOKEN), true);
  });

  it("returns false for wrong token", () => {
    assert.equal(validateDmToken("wrong-token"), false);
  });

  it("returns false for undefined", () => {
    assert.equal(validateDmToken(undefined), false);
  });

  it("returns false for array value", () => {
    assert.equal(validateDmToken(["token"]), false);
  });

  it("returns false for empty string", () => {
    assert.equal(validateDmToken(""), false);
  });

  // ⚠ BUG: auth.mts uses === instead of crypto.timingSafeEqual().
  // Timing-safe comparison is required to prevent timing side-channel
  // attacks on the DM token. See roadmap Phase 5 High Priority.
  it("uses === comparison (documents timing-unsafe bug)", () => {
    // The fact that this test passes at all demonstrates === comparison.
    // A timingSafeEqual implementation would also pass, but would require
    // Buffer conversion and length check. This test documents current behavior.
    assert.equal(validateDmToken(TEST_TOKEN), true);
    assert.equal(validateDmToken(TEST_TOKEN + "x"), false);
  });
});

// ── requireDmToken ────────────────────────────────────────────────

describe("requireDmToken", () => {
  it("does not throw with valid token in x-dm-id header", () => {
    assert.doesNotThrow(() => requireDmToken(makeRequest(TEST_TOKEN)));
  });

  it("throws with statusCode 401 when header is missing", () => {
    assert.throws(
      () => requireDmToken(makeRequest()),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, "DM authorization required");
        assert.equal((err as Error & { statusCode: number }).statusCode, 401);
        return true;
      },
    );
  });

  it("throws with statusCode 401 for wrong token", () => {
    assert.throws(
      () => requireDmToken(makeRequest("wrong-token")),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, "DM authorization required");
        assert.equal((err as Error & { statusCode: number }).statusCode, 401);
        return true;
      },
    );
  });

  it("throws with statusCode 401 for empty string token", () => {
    assert.throws(
      () => requireDmToken(makeRequest("")),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, "DM authorization required");
        assert.equal((err as Error & { statusCode: number }).statusCode, 401);
        return true;
      },
    );
  });
});

// ── validateDmToken — no DM_TOKEN configured ─────────────────────

configMock.restore();
mock.module("#config", { namedExports: { DM_TOKEN: undefined } });
const { validateDmToken: validateNoToken } = await import("#auth");

describe("validateDmToken — no DM_TOKEN configured", () => {
  it("returns false for any string when DM_TOKEN is undefined", () => {
    assert.equal(validateNoToken("any-token"), false);
  });

  it("returns false for undefined when DM_TOKEN is undefined", () => {
    assert.equal(validateNoToken(undefined), false);
  });

  it("returns false for empty string when DM_TOKEN is undefined", () => {
    assert.equal(validateNoToken(""), false);
  });
});
