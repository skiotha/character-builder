// ── Reference data registry (production loader) ────────────────────
//
// Loads the ability/spell (trait), boon/sin (talent) and quality
// catalogs from `reference/*.<DEFAULT_LOCALE>.json` and pre-deserializes
// them into synchronous lookup maps behind the `Registry` interface
// (contract + result types live in `./registry-types.mts`). Wired once
// at startup in `src/app.mts`, mirroring the quality-index load it
// replaces; the in-memory test stub lives in `test/helpers/registry.mts`.
//
// Load posture (ADR-016): catalog data is trusted build input, so
// deserialization is FAIL-FAST — a malformed effect or action throws
// at startup naming the offending entry, rather than silently
// dropping it (contrast the warn-and-skip path for untrusted runtime
// `character.effects[]`). Tier stacking is additive (ADR-014):
// `lookupTrait(id, "master")` returns novice + adept + master effects and
// actions, with actions kept in tier-ascending order to satisfy the
// `collectActions` rewrite-by-id contract (`registry-types.mts`).

import * as ref from "#models/reference";
import { deserializeAction, deserializeEffect } from "./effects.mts";

import { DEFAULT_LOCALE } from "#config";

import type { ReferenceEntry } from "#models/reference";
import type {
  Registry,
  TalentLookupResult,
  TraitLookupResult,
} from "./registry-types.mts";
import type {
  AbilityTier,
  Quality,
  Reaction,
  ResolvedEffect,
  SpecialAttack,
} from "#rpg-types";

const TIER_ORDER: readonly AbilityTier[] = ["novice", "adept", "master"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Pre-deserialize one trait entry into an additive per-tier lookup.
 *
 * Returns a result for every tier in `TIER_ORDER` (even tiers the entry
 * doesn't explicitly define) so a character holding the trait at a tier
 * that introduces no new effects still resolves to the accumulation of
 * the tiers below it. Effects and actions accumulate in tier-ascending
 * order; actions keep that order so a master-tier rewrite of a same-id
 * action supersedes its lower-tier version in `collectActions`.
 */
function deserializeTrait(
  entry: ReferenceEntry,
  statusIds: ReadonlySet<string>,
): Map<AbilityTier, TraitLookupResult> {
  const results = new Map<AbilityTier, TraitLookupResult>();
  const tiers = (entry as { tiers?: unknown }).tiers;

  const effects: ResolvedEffect[] = [];
  const specialAttacks: SpecialAttack[] = [];
  const reactions: Reaction[] = [];

  for (const tier of TIER_ORDER) {
    const tierObj = isRecord(tiers) ? tiers[tier] : undefined;
    if (isRecord(tierObj)) {
      const where = `${entry.source ?? "trait"}:${entry.id}:${tier}`;

      const rawEffects = tierObj.effects;
      if (Array.isArray(rawEffects)) {
        rawEffects.forEach((raw, i) => {
          const eff = deserializeEffect(raw, `${where}.effects[${i}]`);
          if (eff) effects.push(eff);
        });
      }

      const rawSpecials = tierObj.specialAttacks;
      if (Array.isArray(rawSpecials)) {
        rawSpecials.forEach((raw, i) => {
          const action = deserializeAction(
            raw,
            `${where}.specialAttacks[${i}]`,
            statusIds,
          );
          if (action.trigger !== "manual") {
            throw new Error(
              `[registry] Special attack '${action.id}' at ${where} must ` +
                `have trigger "manual" (found "${action.trigger}").`,
            );
          }
          specialAttacks.push(action as SpecialAttack);
        });
      }

      const rawReactions = tierObj.reactions;
      if (Array.isArray(rawReactions)) {
        rawReactions.forEach((raw, i) => {
          const action = deserializeAction(
            raw,
            `${where}.reactions[${i}]`,
            statusIds,
          );
          if (action.trigger === "manual") {
            throw new Error(
              `[registry] Reaction '${action.id}' at ${where} must not have ` +
                `trigger "manual" (use specialAttacks[] for manual actions).`,
            );
          }
          reactions.push(action as Reaction);
        });
      }
    }

    results.set(tier, {
      effects: [...effects],
      specialAttacks: [...specialAttacks],
      reactions: [...reactions],
    });
  }

  return results;
}

/**
 * Pre-deserialize one talent (boon / sin) entry to its flat top-level
 * effect set. Level is ignored — talents contribute set-membership flags
 * (their numeric value is ignored per ADR-015 §3a); numeric level-scaling
 * is unimplemented.
 */
function deserializeTalent(entry: ReferenceEntry): TalentLookupResult {
  const effects: ResolvedEffect[] = [];
  const rawEffects = (entry as { effects?: unknown }).effects;
  if (Array.isArray(rawEffects)) {
    rawEffects.forEach((raw, i) => {
      const eff = deserializeEffect(
        raw,
        `${entry.source ?? "talent"}:${entry.id}.effects[${i}]`,
      );
      if (eff) effects.push(eff);
    });
  }
  return { effects };
}

/**
 * Build the quality index (ADR-016). Quality `effects[]` are authored in
 * the typed `ResolvedEffect` shape and pass through unchanged; the
 * reference-lint test validates them.
 */
function buildQualityIndex(entries: ReferenceEntry[]): Map<string, Quality> {
  const map = new Map<string, Quality>();
  for (const entry of entries) {
    map.set(entry.id, {
      id: entry.id,
      ...(typeof entry.name === "string" ? { name: entry.name } : {}),
      ...(typeof entry.description === "string"
        ? { description: entry.description }
        : {}),
      effects: Array.isArray(entry.effects)
        ? (entry.effects as ResolvedEffect[])
        : [],
    });
  }
  return map;
}

/**
 * Load and pre-deserialize the reference registry at `DEFAULT_LOCALE`.
 * Awaited once at startup (mirrors `loadQualityIndex`); the returned
 * `Registry`'s lookups are pure synchronous `Map` reads, so `recalculate`
 * stays synchronous. Throws on any malformed catalog entry.
 */
export async function loadRegistry(): Promise<Registry> {
  const [traitEntries, talentEntries, qualityEntries, statusEntries] =
    await Promise.all([
      ref.getMerged("traits", DEFAULT_LOCALE),
      ref.getMerged("talents", DEFAULT_LOCALE),
      ref.getTopic("qualities", DEFAULT_LOCALE),
      ref.getTopic("statuses", DEFAULT_LOCALE),
    ]);

  const statusIds = new Set<string>(statusEntries.map((entry) => entry.id));

  // Traits — pre-deserialize every (id, tier) to a flattened result.
  const traitResults = new Map<string, TraitLookupResult>();
  for (const entry of traitEntries) {
    for (const [tier, result] of deserializeTrait(entry, statusIds)) {
      traitResults.set(`${entry.id}:${tier}`, result);
    }
  }

  // Talents — flat top-level effects, level-independent (no scaling).
  const talentResults = new Map<string, TalentLookupResult>();
  for (const entry of talentEntries) {
    talentResults.set(entry.id, deserializeTalent(entry));
  }

  // Qualities — ADR-016 registry (passthrough). Slot-2 needs `own`.
  const qualityIndex = buildQualityIndex(qualityEntries);
  if (!qualityIndex.has("own")) {
    throw new Error(
      `[registry] Quality registry is missing the 'own' quality required ` +
        `by combat slot 2 (NB-39). Add an 'own' entry to ` +
        `reference/qualities.${DEFAULT_LOCALE}.json.`,
    );
  }

  console.log(
    `[registry] Loaded ${traitEntries.length} traits, ` +
      `${talentEntries.length} talents, ${qualityIndex.size} qualities ` +
      `(locale=${DEFAULT_LOCALE}).`,
  );

  return {
    lookupTrait: (id, tier) => traitResults.get(`${id}:${tier}`) ?? null,
    lookupTalent: (id) => talentResults.get(id) ?? null,
    lookupQuality: (id) => qualityIndex.get(id) ?? null,
  };
}
