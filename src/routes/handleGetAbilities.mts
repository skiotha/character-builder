import * as nagara from "../models/abilities.mts";

export async function handleGetAbilities(req, res) {
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
