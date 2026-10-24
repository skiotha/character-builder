import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  deserializeAction,
  deserializeEffect,
} from "../../src/rules/effects.mts";

import { REFERENCE_DIR, LOCALES } from "#config";

import type { PrimaryAttributeName } from "#rpg-types";

// ── Reference catalog lint (report-all) ────────────────────────────
//
// Promotes the semantic checks from the former `scripts/audit-reference.mts`
// into `npm test`, delegating effect/action SHAPE validation to the same
// `deserializeEffect` / `deserializeAction` primitives the production
// loader uses (so the lint and the engine can never drift). On top of the
// shape pass it adds the cross-reference checks the deserializers can't do
// in isolation: every `appliesTo` / `weaponQuality` / `armorQuality` /
// equipment quality id must resolve in the weapon / quality catalogs, ids
// are unique per file, and the own-slot `own` anchor exists (NB-39). The
// optional picker / card metadata keys (reference-authoring §0.8) are
// checked for placement and vocabulary by `checkPickerMetadata`.
//
// Report-all: every problem in a locale is collected and dumped together
// rather than bailing on the first, so an authoring pass sees the whole
// list at once. Structural en/ru parity is enforced separately by
// `test/reference-locale-drift.test.mts`.

const TRAIT_TOPICS = ["abilities", "spells"] as const;
const TALENT_TOPICS = ["boons", "sins"] as const;
const TIERS = ["novice", "adept", "master"] as const;

interface Entry {
  id: string;
  [key: string]: unknown;
}

async function loadTopic(topic: string, locale: string): Promise<Entry[]> {
  const filePath = path.join(REFERENCE_DIR, `${topic}.${locale}.json`);
  return JSON.parse(await readFile(filePath, "utf8")) as Entry[];
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

// ── Picker / card metadata (reference-authoring §0.8) ──────────────
//
// Canonical tradition keys, each owned by exactly one tradition ability.
// The key is the matching contract shared by an ability's `tradition`, a
// spell's / ritual's `traditions[]` and (engine-derived) the character's
// `traditions[]`; localized `tags` are never matched on.
export const TRADITION_ABILITY_BY_KEY: Readonly<Record<string, string>> = {
  order: "mystical-tradition-order",
  circle: "mystical-tradition-witches-circle",
  theurgy: "mystical-tradition-theurgy",
  tribe: "mystical-tradition-tribe",
  sorcery: "mystical-tradition-sorcery",
  sirens: "mystical-tradition-sirens",
  symbolism: "mystical-tradition-symbolism",
  runes: "mystical-tradition-rune-magic",
};

const PRIMARY_ATTRIBUTES = [
  "accurate",
  "cunning",
  "discreet",
  "appealing",
  "quick",
  "resolute",
  "vigilant",
  "strong",
] as const satisfies readonly PrimaryAttributeName[];

// Typecheck fails if `PrimaryAttributeName` gains a member missing above.
const _primaryExhaustive: Exclude<
  PrimaryAttributeName,
  (typeof PRIMARY_ATTRIBUTES)[number]
> extends never
  ? true
  : never = true;
void _primaryExhaustive;

const PRIMARY_SET: ReadonlySet<string> = new Set(PRIMARY_ATTRIBUTES);
const AVAILABILITY_VALUES: ReadonlySet<string> = new Set(["creation", "faction"]);

// `startingEquipment[].kind` → the catalog its `id` must resolve in.
// Extend alongside new item catalogs.
const STARTING_EQUIPMENT_CATALOG: Readonly<Record<string, string>> = {
  weapon: "weapons",
  armor: "armor",
};
const STARTING_EQUIPMENT_KEYS: ReadonlySet<string> = new Set(["kind", "id", "count"]);

/** Card-line ceiling, in code points, for `tiers.<rank>.summary` (§0.8). */
export const SUMMARY_MAX_LENGTH = 140;

/** Where a metadata key may sit inside an entry (reference-authoring §0.8). */
type MetadataSite = "entry" | "rank" | "effect";

// Allowed site for each metadata key, per topic. `entry` = top level,
// `rank` = `tiers.<rank>`, `effect` = a Tier B / C object in
// `tiers.<rank>.effects[]` (Tier A stat math is never rolled). A key
// absent here is not used on that topic at all.
const METADATA_PLACEMENT: Readonly<
  Record<string, Readonly<Record<string, MetadataSite>>>
> = {
  abilities: {
    tradition: "entry",
    availability: "entry",
    startingEquipment: "entry",
    summary: "rank",
    check: "effect",
  },
  spells: { traditions: "entry", summary: "rank", check: "effect" },
  boons: { check: "entry" },
  sins: { check: "entry" },
  rituals: { traditions: "entry" },
};

const METADATA_KEYS: ReadonlySet<string> = new Set([
  "tradition",
  "traditions",
  "availability",
  "startingEquipment",
  "check",
  "summary",
]);

const SITE_LABEL: Readonly<Record<MetadataSite, string>> = {
  entry: "the entry itself",
  rank: "tiers.<rank>",
  effect: "a Tier B / C object in tiers.<rank>.effects[]",
};

function siteOf(path: readonly (string | number)[]): MetadataSite | null {
  if (path.length === 0) return "entry";
  const [tiers, rank, effects, index] = path;
  if (tiers !== "tiers" || !(TIERS as readonly unknown[]).includes(rank)) {
    return null;
  }
  if (path.length === 2) return "rank";
  if (path.length === 4 && effects === "effects" && typeof index === "number") {
    return "effect";
  }
  return null;
}

function formatPath(path: readonly (string | number)[]): string {
  return path
    .map((seg) => (typeof seg === "number" ? `[${seg}]` : `.${seg}`))
    .join("");
}

/**
 * Validate the optional picker / card metadata keys (`tradition`,
 * `traditions`, `availability`, `startingEquipment`, `check`, `summary`)
 * for placement, shape and vocabulary. Every occurrence of those keys
 * anywhere inside an entry is checked against `METADATA_PLACEMENT`, so a
 * key authored at the wrong depth fails instead of being silently
 * ignored. `startingEquipment` ids must resolve in the `weapons` / `armor`
 * lists passed in `files`. Every key is optional here, so a partially
 * authored catalog passes; completeness is asserted separately. Returns
 * one message per problem (report-all).
 */
export function checkPickerMetadata(
  files: Readonly<Record<string, readonly Entry[]>>,
): string[] {
  const errors: string[] = [];

  // `check` lists alternatives for one roll (OR), always as an array.
  const checkCheck = (value: unknown, where: string): void => {
    if (!Array.isArray(value) || value.length === 0) {
      errors.push(`${where}: check must be a non-empty array of primary attributes`);
      return;
    }
    const seen = new Set<unknown>();
    for (const attr of value) {
      if (typeof attr !== "string" || !PRIMARY_SET.has(attr)) {
        errors.push(
          `${where}: check ${JSON.stringify(attr)} is not a primary attribute (${PRIMARY_ATTRIBUTES.join(", ")})`,
        );
      }
      if (seen.has(attr)) {
        errors.push(`${where}: duplicate check attribute ${JSON.stringify(attr)}`);
      }
      seen.add(attr);
    }
  };

  const checkTraditionsArray = (value: unknown, where: string): void => {
    if (!Array.isArray(value) || value.length === 0) {
      errors.push(`${where}: traditions must be a non-empty array of tradition keys`);
      return;
    }
    const seen = new Set<unknown>();
    for (const key of value) {
      if (typeof key !== "string" || !(key in TRADITION_ABILITY_BY_KEY)) {
        errors.push(`${where}: unknown tradition key ${JSON.stringify(key)}`);
      }
      if (seen.has(key)) {
        errors.push(`${where}: duplicate tradition key ${JSON.stringify(key)}`);
      }
      seen.add(key);
    }
  };

  const checkStartingEquipment = (value: unknown, where: string): void => {
    if (!Array.isArray(value) || value.length === 0) {
      errors.push(`${where}: startingEquipment must be a non-empty array of { kind, id, count? }`);
      return;
    }
    const seen = new Set<string>();
    value.forEach((raw, i) => {
      const at = `${where}[${i}]`;
      const item = asRecord(raw);
      for (const key of Object.keys(item)) {
        if (!STARTING_EQUIPMENT_KEYS.has(key)) errors.push(`${at}: unknown key '${key}'`);
      }
      const catalog = STARTING_EQUIPMENT_CATALOG[item.kind as string];
      if (typeof item.kind !== "string" || !catalog) {
        errors.push(
          `${at}: kind ${JSON.stringify(item.kind)} must be one of ${Object.keys(STARTING_EQUIPMENT_CATALOG).join(", ")}`,
        );
      } else if (!(files[catalog] ?? []).some((e) => e.id === item.id)) {
        errors.push(`${at}: unknown ${item.kind} id ${JSON.stringify(item.id)}`);
      }
      if ("count" in item) {
        const n = item.count;
        if (typeof n !== "number" || !Number.isInteger(n) || n < 1) {
          errors.push(`${at}: count must be a positive integer`);
        }
      }
      const key = `${String(item.kind)}:${String(item.id)}`;
      if (seen.has(key)) errors.push(`${at}: duplicate item (use count)`);
      seen.add(key);
    });
  };

  const checkValue = (
    entry: Entry,
    key: string,
    value: unknown,
    where: string,
  ): void => {
    switch (key) {
      case "tradition":
        if (typeof value !== "string" || !(value in TRADITION_ABILITY_BY_KEY)) {
          errors.push(`${where}: unknown tradition key ${JSON.stringify(value)}`);
        } else if (TRADITION_ABILITY_BY_KEY[value] !== entry.id) {
          errors.push(
            `${where}: tradition '${value}' belongs to '${TRADITION_ABILITY_BY_KEY[value]}'`,
          );
        }
        return;
      case "traditions":
        return checkTraditionsArray(value, where);
      case "availability":
        if (!AVAILABILITY_VALUES.has(value as string)) {
          errors.push(
            `${where}: availability ${JSON.stringify(value)} must be "creation" or "faction"`,
          );
        }
        return;
      case "startingEquipment":
        return checkStartingEquipment(value, where);
      case "check":
        return checkCheck(value, where);
      case "summary":
        if (typeof value !== "string" || value.trim().length === 0) {
          errors.push(`${where}: summary must be a non-empty string`);
        } else if ([...value].length > SUMMARY_MAX_LENGTH) {
          errors.push(
            `${where}: summary is ${[...value].length} characters (max ${SUMMARY_MAX_LENGTH})`,
          );
        }
        return;
    }
  };

  for (const [topic, placement] of Object.entries(METADATA_PLACEMENT)) {
    for (const entry of files[topic] ?? []) {
      // Report-all walk: every metadata key at any depth is validated;
      // the walk does not descend into a metadata value itself.
      const visit = (node: unknown, path: (string | number)[]): void => {
        if (Array.isArray(node)) {
          node.forEach((child, i) => visit(child, [...path, i]));
          return;
        }
        if (!node || typeof node !== "object") return;
        const obj = node as Record<string, unknown>;
        for (const [key, value] of Object.entries(obj)) {
          if (!METADATA_KEYS.has(key)) {
            visit(value, [...path, key]);
            continue;
          }
          const where = `${topic}/${entry.id}${formatPath([...path, key])}`;
          const allowed = placement[key];
          const site = siteOf(path);
          if (allowed === undefined) {
            errors.push(`${where}: '${key}' is not used on ${topic}`);
          } else if (site !== allowed) {
            errors.push(`${where}: '${key}' belongs on ${SITE_LABEL[allowed]}`);
          } else if (allowed === "effect" && obj.tier === "A") {
            errors.push(
              `${where}: '${key}' is not allowed on Tier A (stat-math) effects`,
            );
          } else {
            checkValue(entry, key, value, where);
          }
        }
      };
      visit(entry, []);
    }
  }

  return errors;
}

/**
 * Authoring-completeness gaps for the picker metadata: every tradition
 * ability carries its key, every spell and ritual lists its traditions,
 * and the retired `mystical-powers` placeholder is gone.
 */
export function pickerMetadataGaps(
  files: Readonly<Record<string, readonly Entry[]>>,
): string[] {
  const gaps: string[] = [];
  const abilities = files.abilities ?? [];
  for (const [key, abilityId] of Object.entries(TRADITION_ABILITY_BY_KEY)) {
    const ability = abilities.find((e) => e.id === abilityId);
    if (!ability) gaps.push(`abilities: missing tradition ability '${abilityId}'`);
    else if (ability.tradition !== key) {
      gaps.push(`abilities/${abilityId}: missing tradition '${key}'`);
    }
  }
  for (const topic of ["spells", "rituals"] as const) {
    for (const entry of files[topic] ?? []) {
      if (!("traditions" in entry)) gaps.push(`${topic}/${entry.id}: missing traditions`);
    }
  }
  if (abilities.some((e) => e.id === "mystical-powers")) {
    gaps.push("abilities: retired placeholder 'mystical-powers' still present");
  }
  return gaps;
}

describe("reference-lint", () => {
  for (const locale of LOCALES) {
    it(`${locale}: catalog is well-formed and cross-references resolve`, async () => {
      const [
        abilities,
        spells,
        boons,
        sins,
        rituals,
        weapons,
        armor,
        qualities,
        statuses,
      ] = await Promise.all([
        loadTopic("abilities", locale),
        loadTopic("spells", locale),
        loadTopic("boons", locale),
        loadTopic("sins", locale),
        loadTopic("rituals", locale),
        loadTopic("weapons", locale),
        loadTopic("armor", locale),
        loadTopic("qualities", locale),
        loadTopic("statuses", locale),
      ]);

      const qualityIds = new Set(qualities.map((q) => q.id));
      const statusIds = new Set(statuses.map((s) => s.id));

      const errors: string[] = [];

      // Slot-2 anchor (NB-39).
      if (!qualityIds.has("own")) {
        errors.push(
          `qualities.${locale}: missing 'own' quality (slot-2 anchor, NB-39)`,
        );
      }

      // Own-slot weapon anchor (NB-45): `loadRegistry` fail-fasts on it,
      // and the creation default seeds from it.
      if (!weapons.some((w) => w.id === "natural_weapon")) {
        errors.push(
          `weapons.${locale}: missing 'natural_weapon' (own-slot anchor, NB-45)`,
        );
      }

      // Per-file id uniqueness.
      const files: Record<string, Entry[]> = {
        abilities,
        spells,
        boons,
        sins,
        rituals,
        weapons,
        armor,
        qualities,
        statuses,
      };
      for (const [name, list] of Object.entries(files)) {
        const seen = new Set<string>();
        for (const entry of list) {
          if (seen.has(entry.id)) {
            errors.push(`${name}.${locale}: duplicate id '${entry.id}'`);
          }
          seen.add(entry.id);
        }
      }

      const checkPredicates = (appliesTo: unknown, where: string): void => {
        // Only `quality` predicate values are resolved here (against the
        // ADR-016 quality registry). `id` / `type` predicate values are
        // intentionally NOT resolved against the weapon catalog: the
        // authored predicate vocabulary is looser than the weapon `id` /
        // `type` fields (conceptual categories like "short" / "axe"), the
        // engine's `matchesPredicates` simply no-ops on a non-matching
        // predicate, and whether every such predicate resolves to a live
        // weapon is an RPG-authoring question rather than an engine
        // invariant (the former audit did not gate on it either).
        for (const raw of asArray(appliesTo)) {
          const pred = asRecord(raw);
          if (pred.kind !== "quality") continue;
          for (const v of asArray(pred.values)) {
            if (typeof v === "string" && !qualityIds.has(v)) {
              errors.push(
                `${where}: appliesTo quality '${v}' is not a quality id`,
              );
            }
          }
        }
      };

      const checkEffect = (raw: unknown, where: string): void => {
        try {
          deserializeEffect(raw as never, where);
        } catch (err) {
          errors.push(`${where}: ${(err as Error).message}`);
        }
        const effect = asRecord(raw);
        checkPredicates(effect.appliesTo, where);
        const target = asRecord(effect.target);
        if (
          (target.kind === "weaponQuality" || target.kind === "armorQuality") &&
          typeof target.quality === "string" &&
          !qualityIds.has(target.quality)
        ) {
          errors.push(
            `${where}: target quality '${target.quality}' is not a quality id`,
          );
        }
      };

      const checkAction = (
        raw: unknown,
        where: string,
        placement: "specialAttack" | "reaction",
      ): void => {
        try {
          const action = deserializeAction(raw, where, statusIds);
          if (placement === "specialAttack" && action.trigger !== "manual") {
            errors.push(`${where}: specialAttack must have trigger "manual"`);
          }
          if (placement === "reaction" && action.trigger === "manual") {
            errors.push(
              `${where}: reaction must not have trigger "manual" (use specialAttacks[])`,
            );
          }
        } catch (err) {
          errors.push(`${where}: ${(err as Error).message}`);
        }
        checkPredicates(asRecord(raw).appliesTo, where);
      };

      // Traits (abilities + spells): per-tier effects + actions.
      for (const topic of TRAIT_TOPICS) {
        for (const entry of files[topic]!) {
          const tiers = asRecord(entry.tiers);
          for (const tier of TIERS) {
            const tierObj = asRecord(tiers[tier]);
            asArray(tierObj.effects).forEach((e, i) =>
              checkEffect(e, `${topic}/${entry.id}:${tier}.effects[${i}]`),
            );
            asArray(tierObj.specialAttacks).forEach((a, i) =>
              checkAction(
                a,
                `${topic}/${entry.id}:${tier}.specialAttacks[${i}]`,
                "specialAttack",
              ),
            );
            asArray(tierObj.reactions).forEach((a, i) =>
              checkAction(
                a,
                `${topic}/${entry.id}:${tier}.reactions[${i}]`,
                "reaction",
              ),
            );
          }
        }
      }

      // Talents (boons + sins) and rituals: top-level effects only.
      for (const topic of [...TALENT_TOPICS, "rituals"] as const) {
        for (const entry of files[topic]!) {
          asArray(entry.effects).forEach((e, i) =>
            checkEffect(e, `${topic}/${entry.id}.effects[${i}]`),
          );
        }
      }

      // Equipment qualities resolve in the registry (ADR-016).
      for (const weapon of weapons) {
        for (const q of asArray(weapon.qualities)) {
          if (typeof q === "string" && !qualityIds.has(q)) {
            errors.push(
              `weapons.${locale}: weapon '${weapon.id}' has unknown quality '${q}'`,
            );
          }
        }
      }
      for (const piece of armor) {
        for (const q of asArray(piece.qualities)) {
          if (typeof q === "string" && !qualityIds.has(q)) {
            errors.push(
              `armor.${locale}: armor '${piece.id}' has unknown quality '${q}'`,
            );
          }
        }
      }

      errors.push(...checkPickerMetadata(files));

      assert.equal(
        errors.length,
        0,
        `reference-lint found ${errors.length} problem(s) in ${locale}:\n` +
          errors.join("\n"),
      );
    });
  }

  it("picker metadata is fully authored (en)", async () => {
    const [abilities, spells, rituals] = await Promise.all([
      loadTopic("abilities", "en"),
      loadTopic("spells", "en"),
      loadTopic("rituals", "en"),
    ]);
    const gaps = pickerMetadataGaps({ abilities, spells, rituals });
    assert.equal(
      gaps.length,
      0,
      `${gaps.length} picker-metadata gap(s):\n` + gaps.slice(0, 20).join("\n"),
    );
  });
});

describe("checkPickerMetadata", () => {
  const ability = (extra: Record<string, unknown>): Entry => ({
    id: "mystical-tradition-order",
    ...extra,
  });

  it("accepts correctly placed metadata", () => {
    const errors = checkPickerMetadata({
      abilities: [
        ability({
          tradition: "order",
          availability: "faction",
          startingEquipment: [
            { kind: "weapon", id: "staff" },
            { kind: "armor", id: "witchs_robe", count: 2 },
          ],
          tiers: {
            novice: {
              summary: "Short line.",
              effects: [{ tier: "C", description: "Roll.", check: ["resolute"] }],
            },
            adept: {
              effects: [
                { tier: "C", description: "Roll.", check: ["cunning", "appealing"] },
                {
                  tier: "B",
                  target: { kind: "flag", name: "trueSight" },
                  modifier: { type: "addFlat", value: 1 },
                  check: ["vigilant"],
                },
              ],
            },
          },
        }),
      ],
      spells: [
        {
          id: "s",
          traditions: ["runes", "theurgy", "circle"],
          tiers: { master: { effects: [{ tier: "C", check: ["vigilant"] }] } },
        },
      ],
      boons: [{ id: "b", check: ["cunning", "vigilant"] }],
      sins: [],
      rituals: [{ id: "r", traditions: ["order"] }],
      weapons: [{ id: "staff" }],
      armor: [{ id: "witchs_robe" }],
    });
    assert.deepEqual(errors, []);
  });

  it("rejects unknown and mismatched tradition keys", () => {
    const errors = checkPickerMetadata({
      abilities: [
        ability({ tradition: "witchcraft" }),
        { id: "mystical-tradition-tribe", tradition: "order" },
      ],
      spells: [{ id: "s", traditions: ["witchcraft", "runes", "runes"] }],
      rituals: [{ id: "r", traditions: [] }],
    });
    assert.equal(errors.length, 5, errors.join("\n"));
  });

  it("rejects malformed check lists", () => {
    const narrative = (check: unknown) => ({ effects: [{ tier: "C", check }] });
    const errors = checkPickerMetadata({
      abilities: [
        ability({ tiers: { adept: narrative(["Cunning"]), master: narrative([]) } }),
      ],
      boons: [{ id: "b", check: "cunning" }],
      sins: [{ id: "x", check: ["strength", "quick", "quick"] }],
    });
    // Bad attribute, empty list, bare string, bad attribute + duplicate.
    assert.equal(errors.length, 5, errors.join("\n"));
  });

  it("rejects misplaced keys at any depth", () => {
    const errors = checkPickerMetadata({
      abilities: [
        ability({
          check: ["quick"],
          summary: "s",
          traditions: ["order"],
          tiers: {
            novice: {
              check: ["quick"],
              effects: [
                { tier: "C", summary: "s" },
                {
                  tier: "A",
                  target: { kind: "secondary", stat: "defense" },
                  modifier: { type: "addFlat", value: 1 },
                  check: ["quick"],
                },
              ],
              specialAttacks: [{ id: "x", check: ["strong"] }],
            },
          },
        }),
      ],
      spells: [{ id: "s", tradition: "order", availability: "faction" }],
      boons: [{ id: "b", summary: "s", traditions: ["order"] }],
      rituals: [{ id: "r", check: ["quick"] }],
    });
    // Ability: entry check / summary / traditions, rank check, effect
    // summary, check on a Tier A effect, check in an action (7);
    // spell (2); boon (2); ritual (1).
    assert.equal(errors.length, 12, errors.join("\n"));
  });

  it("rejects malformed availability and summary", () => {
    const errors = checkPickerMetadata({
      abilities: [
        ability({
          availability: "never",
          tiers: {
            novice: { summary: "" },
            master: { summary: "x".repeat(SUMMARY_MAX_LENGTH + 1) },
          },
        }),
      ],
    });
    assert.equal(errors.length, 3, errors.join("\n"));
  });

  it("accepts a summary at exactly the length cap", () => {
    const errors = checkPickerMetadata({
      abilities: [ability({ tiers: { adept: { summary: "ж".repeat(SUMMARY_MAX_LENGTH) } } })],
    });
    assert.deepEqual(errors, []);
  });

  it("rejects malformed startingEquipment", () => {
    const errors = checkPickerMetadata({
      abilities: [
        ability({ startingEquipment: "A staff." }),
        {
          id: "a2",
          startingEquipment: [
            { kind: "tool", id: "kit" },
            { kind: "weapon", id: "nope" },
            { kind: "weapon", id: "staff", count: 0, note: "x" },
            { kind: "weapon", id: "staff" },
          ],
        },
      ],
      weapons: [{ id: "staff" }],
      armor: [],
    });
    // Not an array; bad kind; unknown id; bad count + unknown key; duplicate.
    assert.equal(errors.length, 6, errors.join("\n"));
  });
});

describe("pickerMetadataGaps", () => {
  it("reports missing tradition keys, spell traditions and the placeholder", () => {
    const gaps = pickerMetadataGaps({
      abilities: [{ id: "mystical-powers" }, { id: "mystical-tradition-order", tradition: "order" }],
      spells: [{ id: "s" }],
      rituals: [{ id: "r", traditions: ["order"] }],
    });
    // 7 tradition abilities missing + 1 spell + the placeholder.
    assert.equal(gaps.length, 9, gaps.join("\n"));
  });
});
