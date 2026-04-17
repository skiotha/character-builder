import { timingSafeEqual } from "node:crypto";

import { DM_TOKEN } from "#config";

import type { NagaraRequest } from "#types";

function tokensMatch(provided: string | undefined): boolean {
  if (!provided || !DM_TOKEN) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(DM_TOKEN);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function requireDmToken(req: NagaraRequest): void {
  const provided = req.headers["x-dm-id"];
  const token = Array.isArray(provided) ? undefined : provided;
  if (!tokensMatch(token)) {
    const error = new Error("DM authorization required") as Error & {
      statusCode: number;
    };
    error.statusCode = 401;
    throw error;
  }
}

function validateDmToken(token: string | string[] | undefined): boolean {
  if (Array.isArray(token)) return false;
  return tokensMatch(token);
}

export { requireDmToken, validateDmToken };
