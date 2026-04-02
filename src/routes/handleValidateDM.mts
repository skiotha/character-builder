import { validateDmToken } from "#auth";
import type { ServerResponse } from "node:http";
import type { NagaraRequest } from "#types";

export async function handleValidateDM(
  req: NagaraRequest,
  res: ServerResponse,
): Promise<boolean> {
  const token = req.headers["x-dm-id"];

  if (validateDmToken(token)) {
    res.writeHead(200);
    res.end();
  } else {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Token validation failed",
      }),
    );
  }

  return true;
}
