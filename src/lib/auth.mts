import { DM_TOKEN } from "#config";

import type { NagaraRequest } from "#types";

function requireDmToken(req: NagaraRequest): void {
  const providedToken = req.headers["x-dm-id"];
  if (!providedToken || providedToken !== DM_TOKEN) {
    const error = new Error("DM authorization required") as Error & {
      statusCode: number;
    };
    error.statusCode = 401;
    throw error;
  }
}

function validateDmToken(token: string | string[] | undefined): boolean {
  if (!token || Array.isArray(token)) return false;
  return token === DM_TOKEN;
}

export { requireDmToken, validateDmToken };
