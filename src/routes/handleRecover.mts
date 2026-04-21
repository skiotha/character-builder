import * as nagara from "#models";
import { sanitizeCharacterForRole } from "#models/sanitization";
import { BodyTooLargeError, MAX_JSON_BODY, readBody } from "../lib/body.mts";
import { createRateLimiter } from "../lib/rateLimit.mts";

import type { ServerResponse } from "node:http";
import type { NagaraRequest } from "#types";
import type { RateLimitResult } from "../lib/rateLimit.mts";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

const nameLimiter = createRateLimiter({
  limit: RATE_LIMIT,
  windowMs: RATE_WINDOW_MS,
});
const ipLimiter = createRateLimiter({
  limit: RATE_LIMIT,
  windowMs: RATE_WINDOW_MS,
});

/**
 * Test-only helper: resets the in-memory rate-limit buckets so that test
 * cases don't bleed into one another. Not intended for production use.
 */
export function __resetRecoveryRateLimiters(): void {
  nameLimiter.reset();
  ipLimiter.reset();
}

function clientIp(req: NagaraRequest): string {
  return req.socket.remoteAddress ?? "unknown";
}

export async function handleRecover(
  req: NagaraRequest,
  res: ServerResponse,
): Promise<boolean> {
  try {
    const body = await readBody(req, MAX_JSON_BODY);
    const { characterName, backupCode } = JSON.parse(body) as {
      characterName?: unknown;
      backupCode?: unknown;
    };

    const nameKey =
      typeof characterName === "string"
        ? characterName.trim().toLowerCase()
        : "";
    const ipKey = clientIp(req);

    const nameCheck: RateLimitResult = nameKey
      ? nameLimiter.check(nameKey)
      : { ok: true };
    const ipCheck: RateLimitResult = ipLimiter.check(ipKey);

    if (!nameCheck.ok || !ipCheck.ok) {
      const retryAfterSec = Math.max(
        nameCheck.ok ? 0 : nameCheck.retryAfterSec,
        ipCheck.ok ? 0 : ipCheck.retryAfterSec,
      );
      res.writeHead(429, {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
      });
      res.end(
        JSON.stringify({
          error: "Too many recovery attempts. Try again later.",
        }),
      );
      return true;
    }

    const character = await nagara.recoverCharacter(
      characterName as string,
      backupCode as string,
    );

    if (character) {
      const sanitized = sanitizeCharacterForRole(
        character as Record<string, unknown>,
        "owner",
      );
      res.writeHead(200);
      res.end(JSON.stringify(sanitized));
    } else {
      res.writeHead(404);
      res.end(
        JSON.stringify({
          error: "Character not found or invalid backup code",
        }),
      );
    }
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      res.writeHead(413);
      res.end(JSON.stringify({ error: error.message }));
    } else {
      res.writeHead(400);
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
  }

  return true;
}
