// ── Catalog reference validation ────────────────────────────────────
//
// Strict catalog-membership validation for the character's reference
// arrays: reference files are the sole source of truth — neither the UI
// nor sibling apps may invent items, so every authored id must resolve
// in its catalog. Runs over the MERGED character (creation: defaults +
// payload; update: stored character + applied updates) so wholesale
// parent-object writes cannot smuggle unknown ids past per-field checks.
//
// Scope is id-membership plus structural shape — deliberately NO
// field-level canonicalization: entries are authored per-locale by the
// client, so overwriting them from the `DEFAULT_LOCALE` catalog would
// bake EN display strings into characters (accepted trade-off for the
// trusted userbase, ADR-003 posture). Deep validation of bespoke
// `effects[]` on equipment copies is likewise out of scope here — that
// is NB-43's territory; this pass only checks they are arrays.
// `character.effects[]` is NOT validated at all: the warn-and-skip
// boundary in `src/rules/effects.mts` owns that wire shape (NB-35).
//
// Quality ids are checked against the ADR-016 single-namespace registry
// catalog, which pre-empts the engine's strict recalc-time throw: an
// unknown quality on a PATCHed weapon is rejected here with a designed
// error instead of surfacing as a `[quality-registry]` exception
// mid-save. The engine throw stays as defense-in-depth for hand-edited
// on-disk data.
//
// Catalogs are read through the mtime-cached loader (`reference.mts`)
// at `DEFAULT_LOCALE`; the locale-drift lint keeps en/ru id sets equal,
// so EN ids are authoritative (mirrors the engine registry).
//
// Error codes: `UNKNOWN_REFERENCE` for an id that fails to resolve,
// `VALIDATION` for structural problems (wrong type, bad tier, level out
// of the catalog's bounds, slot mismatch).

import { getMerged, getTopic } from "./reference.mts";

import { DEFAULT_LOCALE } from "#config";

import type { ValidationError } from "#types";

const TIERS = new Set(["novice", "adept", "master"]);

interface CatalogIndexes {
  weaponIds: Set<string>;
  /** Armor id → catalog `slot` ("body" | "plug"), when authored. */
  armorSlotById: Map<string, string | null>;
  qualityIds: Set<string>;
  /** Trait id → stamped source ("ability" | "spell"). */
  traitSourceById: Map<string, string>;
  /** Talent id → stamped source + max purchasable level (if authored). */
  talentById: Map<string, { source: string; levels: number | null }>;
  ritualIds: Set<string>;
  /** Traditions resolve against abilities only (curated ability ids). */
  abilityIds: Set<string>;
}

async function loadIndexes(): Promise<CatalogIndexes> {
  const [weapons, armor, qualities, traits, talents, rituals] =
    await Promise.all([
      getTopic("weapons", DEFAULT_LOCALE),
      getTopic("armor", DEFAULT_LOCALE),
      getTopic("qualities", DEFAULT_LOCALE),
      getMerged("traits", DEFAULT_LOCALE),
      getMerged("talents", DEFAULT_LOCALE),
      getTopic("rituals", DEFAULT_LOCALE),
    ]);

  const armorSlotById = new Map<string, string | null>();
  for (const entry of armor) {
    armorSlotById.set(
      entry.id,
      typeof entry.slot === "string" ? entry.slot : null,
    );
  }

  const traitSourceById = new Map<string, string>();
  const abilityIds = new Set<string>();
  for (const entry of traits) {
    traitSourceById.set(entry.id, entry.source ?? "");
    if (entry.source === "ability") abilityIds.add(entry.id);
  }

  const talentById = new Map<string, { source: string; levels: number | null }>();
  for (const entry of talents) {
    talentById.set(entry.id, {
      source: entry.source ?? "",
      levels: typeof entry.levels === "number" ? entry.levels : null,
    });
  }

  return {
    weaponIds: new Set(weapons.map((e) => e.id)),
    armorSlotById,
    qualityIds: new Set(qualities.map((e) => e.id)),
    traitSourceById,
    talentById,
    ritualIds: new Set(rituals.map((e) => e.id)),
    abilityIds,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function structural(field: string, error: string): ValidationError {
  return { field, error, code: "VALIDATION" };
}

function unknownRef(
  field: string,
  id: string,
  catalog: string,
): ValidationError {
  return {
    field,
    error: `Unknown ${catalog} id "${id}" — not in reference/${catalog}.${DEFAULT_LOCALE}.json`,
    code: "UNKNOWN_REFERENCE",
  };
}

/** Validate `qualities[]` on a weapon or armor entry against the
 *  ADR-016 registry catalog. Returns errors; an absent array is the
 *  caller's structural problem, not handled here. */
function checkQualities(
  field: string,
  qualities: unknown,
  qualityIds: Set<string>,
  errors: ValidationError[],
): void {
  if (!Array.isArray(qualities) || !qualities.every((q) => typeof q === "string")) {
    errors.push(structural(`${field}.qualities`, "qualities must be a string array"));
    return;
  }
  for (const q of qualities as string[]) {
    if (!qualityIds.has(q)) {
      errors.push(unknownRef(`${field}.qualities`, q, "qualities"));
    }
  }
}

function checkWeapons(
  character: Record<string, unknown>,
  idx: CatalogIndexes,
  errors: ValidationError[],
): void {
  const equipment = character.equipment;
  if (!isRecord(equipment)) return;
  const weapons = equipment.weapons;
  if (weapons === undefined) return;
  if (!Array.isArray(weapons)) {
    errors.push(structural("equipment.weapons", "must be an array"));
    return;
  }
  weapons.forEach((weapon, i) => {
    const field = `equipment.weapons[${i}]`;
    if (!isRecord(weapon)) {
      errors.push(structural(field, "weapon entry must be an object"));
      return;
    }
    const { id, name, type, damage, effects } = weapon;
    if (typeof id !== "string" || id.length === 0) {
      errors.push(structural(field, "weapon entry requires a string id"));
    } else if (!idx.weaponIds.has(id)) {
      errors.push(unknownRef(field, id, "weapons"));
    }
    if (typeof name !== "string" || name.length === 0) {
      errors.push(structural(field, "weapon entry requires a string name"));
    }
    if (typeof type !== "string" || type.length === 0) {
      errors.push(structural(field, "weapon entry requires a string type"));
    }
    if (typeof damage !== "number" || !Number.isFinite(damage)) {
      errors.push(structural(field, "weapon entry requires a numeric damage"));
    }
    checkQualities(field, weapon.qualities, idx.qualityIds, errors);
    if (effects !== undefined && !Array.isArray(effects)) {
      errors.push(structural(field, "weapon effects must be an array"));
    }
  });
}

function checkArmor(
  character: Record<string, unknown>,
  idx: CatalogIndexes,
  errors: ValidationError[],
): void {
  const equipment = character.equipment;
  if (!isRecord(equipment)) return;
  const armor = equipment.armor;
  if (!isRecord(armor)) return;

  for (const slot of ["body", "plug"] as const) {
    const piece = armor[slot];
    const field = `equipment.armor.${slot}`;
    if (piece === undefined || piece === null) continue;
    if (!isRecord(piece)) {
      errors.push(structural(field, "armor slot must be null or an object"));
      continue;
    }
    const { id, name, effects } = piece;
    if (typeof id !== "string" || id.length === 0) {
      errors.push(structural(field, "armor entry requires a string id"));
    } else if (!idx.armorSlotById.has(id)) {
      errors.push(unknownRef(field, id, "armor"));
    } else {
      // Slot fit: only enforced when the catalog entry authors a slot
      // (catalog completeness is the reference-lint's job, not ours).
      const catalogSlot = idx.armorSlotById.get(id);
      if (catalogSlot !== null && catalogSlot !== slot) {
        errors.push(
          structural(
            field,
            `armor "${id}" is a ${catalogSlot} piece and cannot occupy the ${slot} slot`,
          ),
        );
      }
    }
    if (typeof name !== "string" || name.length === 0) {
      errors.push(structural(field, "armor entry requires a string name"));
    }
    if (typeof piece.armor !== "number" || !Number.isFinite(piece.armor)) {
      errors.push(structural(field, "armor entry requires a numeric armor value"));
    }
    checkQualities(field, piece.qualities, idx.qualityIds, errors);
    if (effects !== undefined && !Array.isArray(effects)) {
      errors.push(structural(field, "armor effects must be an array"));
    }
  }
}

function checkTraits(
  character: Record<string, unknown>,
  idx: CatalogIndexes,
  errors: ValidationError[],
): void {
  const traits = character.traits;
  if (traits === undefined) return;
  if (!Array.isArray(traits)) {
    errors.push(structural("traits", "must be an array"));
    return;
  }
  traits.forEach((trait, i) => {
    const field = `traits[${i}]`;
    if (!isRecord(trait)) {
      errors.push(structural(field, "trait entry must be an object"));
      return;
    }
    const { id, tier, source } = trait;
    if (typeof id !== "string" || id.length === 0) {
      errors.push(structural(field, "trait entry requires a string id"));
      return;
    }
    const catalogSource = idx.traitSourceById.get(id);
    if (catalogSource === undefined) {
      errors.push(unknownRef(field, id, "traits (abilities + spells)"));
      return;
    }
    if (typeof tier !== "string" || !TIERS.has(tier)) {
      errors.push(
        structural(field, `trait tier must be novice | adept | master`),
      );
    }
    if (source !== catalogSource) {
      errors.push(
        structural(
          field,
          `trait "${id}" has source "${String(source)}" but the catalog says "${catalogSource}"`,
        ),
      );
    }
  });
}

function checkTalents(
  character: Record<string, unknown>,
  idx: CatalogIndexes,
  errors: ValidationError[],
): void {
  const talents = character.talents;
  if (talents === undefined) return;
  if (!Array.isArray(talents)) {
    errors.push(structural("talents", "must be an array"));
    return;
  }
  talents.forEach((talent, i) => {
    const field = `talents[${i}]`;
    if (!isRecord(talent)) {
      errors.push(structural(field, "talent entry must be an object"));
      return;
    }
    const { id, level, source } = talent;
    if (typeof id !== "string" || id.length === 0) {
      errors.push(structural(field, "talent entry requires a string id"));
      return;
    }
    const entry = idx.talentById.get(id);
    if (entry === undefined) {
      errors.push(unknownRef(field, id, "talents (boons + sins)"));
      return;
    }
    if (typeof level !== "number" || !Number.isInteger(level) || level < 1) {
      errors.push(structural(field, "talent level must be an integer ≥ 1"));
    } else if (entry.levels !== null && level > entry.levels) {
      errors.push(
        structural(
          field,
          `talent "${id}" level ${level} exceeds the catalog maximum of ${entry.levels}`,
        ),
      );
    }
    if (source !== entry.source) {
      errors.push(
        structural(
          field,
          `talent "${id}" has source "${String(source)}" but the catalog says "${entry.source}"`,
        ),
      );
    }
  });
}

function checkRituals(
  character: Record<string, unknown>,
  idx: CatalogIndexes,
  errors: ValidationError[],
): void {
  const rituals = character.rituals;
  if (rituals === undefined) return;
  if (!Array.isArray(rituals)) {
    errors.push(structural("rituals", "must be an array"));
    return;
  }
  rituals.forEach((ritual, i) => {
    const field = `rituals[${i}]`;
    if (!isRecord(ritual)) {
      errors.push(structural(field, "ritual entry must be an object"));
      return;
    }
    const { id, level } = ritual;
    if (typeof id !== "string" || id.length === 0) {
      errors.push(structural(field, "ritual entry requires a string id"));
      return;
    }
    if (!idx.ritualIds.has(id)) {
      errors.push(unknownRef(field, id, "rituals"));
    }
    if (typeof level !== "number" || !Number.isInteger(level) || level < 1) {
      errors.push(structural(field, "ritual level must be an integer ≥ 1"));
    }
  });
}

function checkTraditions(
  character: Record<string, unknown>,
  idx: CatalogIndexes,
  errors: ValidationError[],
): void {
  const traditions = character.traditions;
  if (traditions === undefined) return;
  if (!Array.isArray(traditions)) {
    errors.push(structural("traditions", "must be an array"));
    return;
  }
  traditions.forEach((id, i) => {
    const field = `traditions[${i}]`;
    if (typeof id !== "string" || id.length === 0) {
      errors.push(structural(field, "tradition must be an ability id string"));
      return;
    }
    if (!idx.abilityIds.has(id)) {
      errors.push(unknownRef(field, id, "abilities"));
    }
  });
}

/** Field roots each sub-check owns, for update-time scoping. */
const CHECK_ROOTS: ReadonlyArray<{
  roots: string[];
  run: (
    character: Record<string, unknown>,
    idx: CatalogIndexes,
    errors: ValidationError[],
  ) => void;
}> = [
  { roots: ["equipment.weapons"], run: checkWeapons },
  { roots: ["equipment.armor"], run: checkArmor },
  { roots: ["traits"], run: checkTraits },
  { roots: ["talents"], run: checkTalents },
  { roots: ["rituals"], run: checkRituals },
  { roots: ["traditions"], run: checkTraditions },
];

function touchesSubtree(touched: string[], root: string): boolean {
  return touched.some(
    (field) =>
      field === root ||
      field.startsWith(`${root}.`) ||
      root.startsWith(`${field}.`),
  );
}

/**
 * Validate the catalog-referencing arrays on a merged character:
 * `equipment.weapons[]`, `equipment.armor.{body,plug}`, `traits[]`,
 * `talents[]`, `rituals[]`, `traditions[]`. Absent fields are skipped
 * (defaulting is the schema's job); present fields are checked for
 * structural shape and strict id membership.
 *
 * @param character the merged character (defaults + payload, or stored
 *   character + applied updates) — never a bare PATCH fragment.
 * @param touchedFields when given (the update path), only the checks
 *   whose subtree intersects a touched field run — stored state the
 *   PATCH never addressed is not re-litigated (e.g. a catalog id that
 *   was removed from the reference files after the character was saved
 *   must not block an unrelated rename).
 * @returns designed validation errors; empty when everything resolves.
 */
export async function validateCatalogRefs(
  character: Record<string, unknown>,
  touchedFields?: string[],
): Promise<ValidationError[]> {
  const active = CHECK_ROOTS.filter(
    ({ roots }) =>
      !touchedFields ||
      roots.some((root) => touchesSubtree(touchedFields, root)),
  );
  if (active.length === 0) return [];

  const idx = await loadIndexes();
  const errors: ValidationError[] = [];
  for (const { run } of active) {
    run(character, idx, errors);
  }
  return errors;
}
