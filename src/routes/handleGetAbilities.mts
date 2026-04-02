import * as nagara from "#models/abilities";
import type { ServerResponse } from "node:http";
import type { NagaraRequest } from "#types";

export async function handleGetAbilities(
  _req: NagaraRequest,
  res: ServerResponse,
): Promise<boolean> {
  try {
    const abilities = await nagara.getAbilities();

    res.setHeader("Cache-Control", "public, max-age=3600");
    res.writeHead(200);
    res.end(JSON.stringify(abilities));
  } catch (error) {
    console.error("Failed to load abilities:", error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: "Failed to load abilities" }));
  } finally {
    return true;
  }
}
