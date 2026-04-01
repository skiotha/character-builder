import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ENCODING, DATA_DIR } from "#config";
import { stat } from "node:fs/promises";

const ABILITIES_PATH = join(DATA_DIR, "abilities.json");
let abilitesCache = null;
let lastModified = 0;

export async function getAbilities() {
  const stats = await stat(ABILITIES_PATH);

  if (!abilitesCache || stats.mtimeMs > lastModified) {
    const data = await readFile(ABILITIES_PATH, ENCODING);
    abilitesCache = JSON.parse(data);
    lastModified = stats.mtimeMs;
    console.log("[Abilities] Cache updated");
  }

  return abilitesCache;
}

export async function getAbility(id) {
  const abilites = await getAbilities();
  return abilites.find((ability) => ability.id === id);
}

export async function getAbilitiesByCategory(category) {
  const abilites = getAbilities();
  return abilites.filter((ability) => ability.category === category);
}
