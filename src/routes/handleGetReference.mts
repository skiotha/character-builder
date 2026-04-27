import * as ref from "#models/reference";
import { parseLocale } from "#locale";
import { LOCAL_ADDRESS } from "#config";

import type { ServerResponse } from "node:http";
import type { NagaraRequest } from "#types";
import type { MergedTopic, SingleTopic } from "#models/reference";

type Mode =
  | { kind: "single"; topic: SingleTopic }
  | { kind: "merged"; topic: MergedTopic };

function createReferenceHandler(mode: Mode) {
  return async function handleGetReference(
    req: NagaraRequest,
    res: ServerResponse,
  ): Promise<boolean> {
    try {
      const url = new URL(req.url ?? "/", `http://${LOCAL_ADDRESS}/`);
      const locale = parseLocale(req, url);
      if (typeof locale !== "string") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: locale.error }));
        return true;
      }

      const entries =
        mode.kind === "single"
          ? await ref.getTopic(mode.topic, locale)
          : await ref.getMerged(mode.topic, locale);

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.writeHead(200);
      res.end(JSON.stringify(entries));
    } catch (error) {
      const topicName = mode.topic;
      console.error(`Failed to load reference '${topicName}':`, error);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `Failed to load ${topicName}` }));
      }
    }
    return true;
  };
}

const handleGetTraits = createReferenceHandler({
  kind: "merged",
  topic: "traits",
});
const handleGetTalents = createReferenceHandler({
  kind: "merged",
  topic: "talents",
});
const handleGetRituals = createReferenceHandler({
  kind: "single",
  topic: "rituals",
});
const handleGetWeapons = createReferenceHandler({
  kind: "single",
  topic: "weapons",
});
const handleGetArmor = createReferenceHandler({
  kind: "single",
  topic: "armor",
});
const handleGetQualities = createReferenceHandler({
  kind: "single",
  topic: "qualities",
});

export {
  handleGetTraits,
  handleGetTalents,
  handleGetRituals,
  handleGetWeapons,
  handleGetArmor,
  handleGetQualities,
};
