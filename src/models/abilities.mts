import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { stat } from "node:fs/promises";

import { ENCODING, DATA_DIR } from "#config";

interface Ability {
  id: string;
  category?: string;
  [key: string]: unknown;
}

const ABILITIES_PATH: string = join(DATA_DIR, "abilities.json");
let abilitiesCache: Ability[] | null = null;
let lastModified: number = 0;

export async function getAbilities(): Promise<Ability[]> {
  const stats = await stat(ABILITIES_PATH);

  if (!abilitiesCache || stats.mtimeMs > lastModified) {
    const data = await readFile(ABILITIES_PATH, ENCODING);
    abilitiesCache = JSON.parse(data) as Ability[];
    lastModified = stats.mtimeMs;
    console.log("[Abilities] Cache updated");
  }

  return abilitiesCache;
}

export async function getAbility(id: string): Promise<Ability | undefined> {
  const abilities = await getAbilities();
  return abilities.find((ability) => ability.id === id);
}

export async function getAbilitiesByCategory(
  category: string,
): Promise<Ability[]> {
  const abilities = await getAbilities();
  return abilities.filter((ability) => ability.category === category);
}
