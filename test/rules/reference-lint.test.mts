import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  deserializeAction,
  deserializeEffect,
} from "../../src/rules/effects.mts";

import { REFERENCE_DIR, LOCALES } from "#config";

// ── Reference catalog lint (report-all) ────────────────────────────
//
// Promotes the semantic checks from the former `scripts/audit-reference.mts`
// into `npm test`, delegating effect/action SHAPE validation to the same
// `deserializeEffect` / `deserializeAction` primitives the production
// loader uses (so the lint and the engine can never drift). On top of the
// shape pass it adds the cross-reference checks the deserializers can't do
// in isolation: every `appliesTo` / `weaponQuality` / `armorQuality` /
// equipment quality id must resolve in the weapon / quality catalogs, ids
// are unique per file, and the slot-2 `own` anchor exists (NB-39).
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

      assert.equal(
        errors.length,
        0,
        `reference-lint found ${errors.length} problem(s) in ${locale}:\n` +
          errors.join("\n"),
      );
    });
  }
});
