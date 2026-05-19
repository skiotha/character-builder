// One-shot audit pass over reference/*.{en,ru}.json.
// Read-only. Reports findings to stdout grouped by category.
//
// Run: node --experimental-strip-types scripts/audit-reference.mts

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const REF_DIR = new URL("../reference/", import.meta.url).pathname.replace(
  /^\//,
  "",
);
const RESOLVED_REF = join(process.cwd(), "reference");

// ── Parser-mirroring constants (kept in sync with src/rules/effects.mts) ──

const KNOWN_PRIMARY = new Set([
  "accurate",
  "cunning",
  "discreet",
  "appealing",
  "quick",
  "resolute",
  "vigilant",
  "strong",
]);
const KNOWN_SECONDARY = new Set([
  "toughness",
  "defense",
  "armor",
  "painThreshold",
  "corruptionThreshold",
  "corruptionMax",
]);
const KNOWN_COMBAT_FIELDS = new Set([
  "attackAttribute",
  "baseDamage",
  "bonusDamage",
]);
const KNOWN_TARGET_KINDS = new Set([
  "primary",
  "secondary",
  "combat",
  "weaponQuality",
  "armorQuality",
  "flag",
  "magicAttribute",
  "initiativeAttribute",
]);
const SETBASE_ONLY_KINDS = new Set(["magicAttribute", "initiativeAttribute"]);
const KNOWN_PREDICATE_KINDS = new Set(["any", "type", "quality", "id"]);
const KNOWN_CONDITION_KINDS = new Set([
  "armorQuality",
  "armorId",
  "armorSlot",
  "noArmor",
]);
const KNOWN_ARMOR_SLOTS = new Set(["body", "plug"]);
const CONDITION_ACCEPTING_TARGETS = new Set(["secondary", "armorQuality"]);
// Item 12 placement table (Chunk J, revised 2026-05-19). `appliesTo` widened
// to include "secondary" per user-locked policy (b) — see bug #34 in
// `.github/bugs/engine-weak-points.md` for the engine-gap follow-up.
const APPLIES_TO_ACCEPTING_TARGETS = new Set([
  "combat",
  "weaponQuality",
  "flag",
  "secondary",
]);
const APPLIES_TO_REQUIRED_TARGETS = new Set(["combat", "weaponQuality"]);
const KNOWN_MODIFIER_TYPES = new Set([
  "setBase",
  "addFlat",
  "multiply",
  "cap",
  "remove",
]);
// EffectFlag vocabulary — kept in sync with `src/rpg-types.mts` `EffectFlag`.
// Used by Item 6 (`inflicts[]` are NOT flags; statuses) and as a sanity
// check on `target.kind="flag"` names.
const KNOWN_EFFECT_FLAGS = new Set([
  "evasion",
  "advantage",
  "deathDenial",
  "darkvision",
  "initiativeExemption",
  "fastSwap",
  "elementsProtection",
  "fireResistance",
  "poisonResistance",
  "knowledge:alchemy",
  "knowledge:alchemy:poisons",
  "knowledge:world",
  "knowledge:world:nature",
  "knowledge:world:warfare",
  "knowledge:world:geography",
  "knowledge:world:underworld",
  "knowledge:world:commerce",
  "knowledge:magic",
  "knowledge:magic:arcane",
  "knowledge:magic:nature",
  "knowledge:magic:light",
  "knowledge:magic:elementalism",
  "knowledge:magic:fel",
  "knowledge:magic:shadow",
  "knowledge:magic:enchantment",
  "trueSight",
]);

// ── Findings buckets ──

type Finding = { file: string; entryId: string; tier?: string; detail: string };
const findings: Record<string, Finding[]> = {
  tierMarkers: [],
  parserRejections: [],
  predicateHygiene: [],
  qualityResolution: [],
  amendmentBlockers: [],
  rogueFields: [],
  actionIds: [],
  // J.3 buckets (Chunk J post-sweep):
  //   placement   — Item 12, appliesTo/condition placement discipline
  //   inflicts    — Item 6, status-id resolution on actions
  //   isFree      — Item 8, trigger="manual" gate
  //   inheritance — Item 1, optional inheritance-shape fields on actions
  placement: [],
  inflicts: [],
  isFree: [],
  inheritance: [],
};
const flagNames = new Set<string>();
const flagOccurrences: Record<string, number> = {};
const qualityIds = new Set<string>();
const qualityRefs = new Map<
  string,
  { file: string; entryId: string; via: string }[]
>();
// Status registry + outgoing inflicts[] references (J.3, Item 6). Same
// resolution pattern as qualities: registry populated by walking
// reference/statuses.*.json; refs accumulated from action.inflicts[].
const statusIds = new Set<string>();
const statusRefs = new Map<
  string,
  { file: string; entryId: string; via: string }[]
>();

// Cross-parent action-id accumulator (ADR-014, Item 9). Same-id entries
// belonging to the SAME parent (ability/spell) are the documented
// rewrite-by-id pattern; same-id across DIFFERENT parents is undefined
// behaviour (engine ordering would decide which one wins, last-trait-
// processed) and almost certainly an authoring slip. Reported via the
// `actionIds` bucket. Walked across both abilities.* and spells.* in
// both locales.
const actionIdOwners = new Map<
  string, // `${actionId}|${field}`  (field = "specialAttack" | "reaction")
  { file: string; parentId: string }
>();

function addFinding(bucket: keyof typeof findings, f: Finding): void {
  findings[bucket]!.push(f);
}

function noteQualityRef(
  id: string,
  file: string,
  entryId: string,
  via: string,
): void {
  if (!qualityRefs.has(id)) qualityRefs.set(id, []);
  qualityRefs.get(id)!.push({ file, entryId, via });
}

function noteStatusRef(
  id: string,
  file: string,
  entryId: string,
  via: string,
): void {
  if (!statusRefs.has(id)) statusRefs.set(id, []);
  statusRefs.get(id)!.push({ file, entryId, via });
}

// ── Per-effect inspection ──

function inspectEffect(
  effect: any,
  file: string,
  entryId: string,
  context: string, // e.g. "abilities.acrobatics.tier=novice.effects[0]"
): void {
  if (!effect || typeof effect !== "object") return;

  const tier = effect.tier;

  // Tier C → must be narrative-only.
  if (tier === "C") {
    if (effect.target !== undefined || effect.modifier !== undefined) {
      addFinding("tierMarkers", {
        file,
        entryId,
        tier,
        detail: `${context}: Tier C carries target/modifier — should be Tier A or drop them`,
      });
    }
    return;
  }

  // Tier A/B → must have target + modifier.
  if (tier === "A" || tier === "B") {
    if (!effect.target || !effect.modifier) {
      addFinding("tierMarkers", {
        file,
        entryId,
        tier,
        detail: `${context}: Tier ${tier} missing target or modifier`,
      });
      return;
    }
  }

  // Target validation.
  const target = effect.target;
  if (target && typeof target === "object") {
    const kind = target.kind;

    if (typeof kind !== "string") {
      addFinding("parserRejections", {
        file,
        entryId,
        tier,
        detail: `${context}: target.kind is not a string`,
      });
    } else if (!KNOWN_TARGET_KINDS.has(kind)) {
      addFinding("parserRejections", {
        file,
        entryId,
        tier,
        detail: `${context}: target.kind="${kind}" not in known set`,
      });
    } else {
      // Per-kind validation.
      switch (kind) {
        case "primary": {
          const stat = target.stat;
          if (typeof stat !== "string") {
            addFinding("parserRejections", {
              file,
              entryId,
              tier,
              detail: `${context}: primary.stat missing/non-string`,
            });
          } else if (!KNOWN_PRIMARY.has(stat)) {
            addFinding("parserRejections", {
              file,
              entryId,
              tier,
              detail: `${context}: primary.stat="${stat}" not in known set`,
            });
          }
          break;
        }
        case "secondary": {
          const stat = target.stat;
          if (typeof stat !== "string") {
            addFinding("parserRejections", {
              file,
              entryId,
              tier,
              detail: `${context}: secondary.stat missing/non-string`,
            });
          } else if (stat === "toughness.max") {
            addFinding("amendmentBlockers", {
              file,
              entryId,
              tier,
              detail: `${context}: secondary.stat="toughness.max" — must be plain "toughness" (Item 11)`,
            });
          } else if (!KNOWN_SECONDARY.has(stat)) {
            addFinding("parserRejections", {
              file,
              entryId,
              tier,
              detail: `${context}: secondary.stat="${stat}" not in known set`,
            });
          }
          break;
        }
        case "combat": {
          const field = target.field;
          if (typeof field !== "string" || !KNOWN_COMBAT_FIELDS.has(field)) {
            addFinding("parserRejections", {
              file,
              entryId,
              tier,
              detail: `${context}: combat.field="${field}" invalid`,
            });
          }
          break;
        }
        case "weaponQuality":
        case "armorQuality": {
          const q = target.quality;
          if (typeof q !== "string" || q.length === 0) {
            addFinding("parserRejections", {
              file,
              entryId,
              tier,
              detail: `${context}: ${kind}.quality missing/empty`,
            });
          } else {
            noteQualityRef(q, file, entryId, `${kind} target`);
          }
          break;
        }
        case "flag": {
          const name = target.name;
          if (typeof name !== "string" || name.length === 0) {
            addFinding("parserRejections", {
              file,
              entryId,
              tier,
              detail: `${context}: flag.name missing/empty`,
            });
          } else {
            flagNames.add(name);
            flagOccurrences[name] = (flagOccurrences[name] ?? 0) + 1;
          }
          break;
        }
        case "magicAttribute":
        case "initiativeAttribute":
          // No additional target fields — setBase-only enforcement happens
          // in the modifier validation below.
          break;
      }
    }
  }

  // Modifier validation.
  const mod = effect.modifier;
  if (mod && typeof mod === "object" && target && typeof target === "object") {
    const type = mod.type;
    const targetKind = target.kind;

    if (typeof type !== "string" || !KNOWN_MODIFIER_TYPES.has(type)) {
      addFinding("parserRejections", {
        file,
        entryId,
        tier,
        detail: `${context}: modifier.type="${type}" invalid`,
      });
    } else {
      // Cross-validate target+modifier compatibility (mirrors parseModifier).
      if (type === "setBase") {
        if (targetKind === "primary") {
          addFinding("parserRejections", {
            file,
            entryId,
            tier,
            detail: `${context}: setBase on primary (rejected — only addFlat/cap accepted)`,
          });
        }
        if (targetKind === "combat" && target.field !== "attackAttribute") {
          addFinding("parserRejections", {
            file,
            entryId,
            tier,
            detail: `${context}: setBase on combat.${target.field} (only attackAttribute accepts setBase)`,
          });
        }
        if (targetKind === "secondary") {
          addFinding("parserRejections", {
            file,
            entryId,
            tier,
            detail: `${context}: setBase on secondary (rejected by parser)`,
          });
        }
        if (
          targetKind === "weaponQuality" ||
          targetKind === "armorQuality" ||
          targetKind === "flag"
        ) {
          addFinding("parserRejections", {
            file,
            entryId,
            tier,
            detail: `${context}: setBase on ${targetKind} (rejected — use addFlat to add)`,
          });
        }
        if (typeof mod.value !== "string" || !KNOWN_PRIMARY.has(mod.value)) {
          addFinding("parserRejections", {
            file,
            entryId,
            tier,
            detail: `${context}: setBase value "${mod.value}" not a primary attribute`,
          });
        }
      } else if (type === "addFlat" || type === "multiply" || type === "cap") {
        if (
          typeof targetKind === "string" &&
          SETBASE_ONLY_KINDS.has(targetKind)
        ) {
          addFinding("parserRejections", {
            file,
            entryId,
            tier,
            detail: `${context}: ${type} on ${targetKind} (only setBase accepted)`,
          });
        }
        if (targetKind === "primary" && type === "multiply") {
          addFinding("parserRejections", {
            file,
            entryId,
            tier,
            detail: `${context}: multiply on primary (rejected — only addFlat/cap accepted)`,
          });
        }
        if (targetKind === "combat" && target.field === "attackAttribute") {
          addFinding("parserRejections", {
            file,
            entryId,
            tier,
            detail: `${context}: ${type} on combat.attackAttribute (only setBase accepted)`,
          });
        }
        if (typeof mod.value !== "number" || !Number.isFinite(mod.value)) {
          addFinding("parserRejections", {
            file,
            entryId,
            tier,
            detail: `${context}: ${type} value "${mod.value}" not a finite number`,
          });
        }
        // multiply/cap on weaponQuality/armorQuality/flag → set-membership only allows addFlat (add) or remove.
        if (
          (targetKind === "weaponQuality" ||
            targetKind === "armorQuality" ||
            targetKind === "flag") &&
          (type === "multiply" || type === "cap")
        ) {
          addFinding("parserRejections", {
            file,
            entryId,
            tier,
            detail: `${context}: ${type} on ${targetKind} (set-membership accepts addFlat or remove only)`,
          });
        }
      } else if (type === "remove") {
        if (
          targetKind !== "weaponQuality" &&
          targetKind !== "armorQuality" &&
          targetKind !== "flag"
        ) {
          addFinding("parserRejections", {
            file,
            entryId,
            tier,
            detail: `${context}: remove on numeric target ${targetKind}`,
          });
        }
      }
    }
  }

  // appliesTo hygiene.
  if (effect.appliesTo !== undefined) {
    const targetKind = target?.kind;
    // Item 12 placement table (J.3): `appliesTo` allowed on
    // {combat, weaponQuality, flag, secondary}. `secondary` is the
    // 2026-05-19 widening (policy b) — engine still ignores the predicate
    // there; see bug #34. Anywhere else the parser strip-warns today and
    // will hard-reject after J.4b.
    if (
      typeof targetKind === "string" &&
      !APPLIES_TO_ACCEPTING_TARGETS.has(targetKind)
    ) {
      addFinding("placement", {
        file,
        entryId,
        tier,
        detail: `${context}: appliesTo on target kind "${targetKind}" — only {combat, weaponQuality, flag, secondary} accept appliesTo (parser will reject)`,
      });
    }
    // Items requiring NON-EMPTY appliesTo to be meaningful.
    if (
      typeof targetKind === "string" &&
      APPLIES_TO_REQUIRED_TARGETS.has(targetKind) &&
      Array.isArray(effect.appliesTo) &&
      effect.appliesTo.length === 0
    ) {
      addFinding("placement", {
        file,
        entryId,
        tier,
        detail: `${context}: ${targetKind} target has empty appliesTo[] — must constrain to at least one weapon predicate`,
      });
    }
    if (Array.isArray(effect.appliesTo)) {
      for (let i = 0; i < effect.appliesTo.length; i++) {
        const pred = effect.appliesTo[i];
        if (!pred || typeof pred !== "object") continue;
        const pk = pred.kind;
        if (typeof pk !== "string" || !KNOWN_PREDICATE_KINDS.has(pk)) {
          addFinding("predicateHygiene", {
            file,
            entryId,
            tier,
            detail: `${context}: appliesTo[${i}].kind="${pk}" invalid`,
          });
          continue;
        }
        if (pk === "quality" && Array.isArray(pred.values)) {
          for (const v of pred.values) {
            if (typeof v === "string")
              noteQualityRef(v, file, entryId, "appliesTo predicate");
          }
        }
      }
    }
  }

  // condition hygiene (ADR-015 §3f, character-level gate).
  const targetKind = target?.kind;
  const condition = effect.condition;
  if (condition !== undefined) {
    if (
      typeof targetKind === "string" &&
      !CONDITION_ACCEPTING_TARGETS.has(targetKind)
    ) {
      addFinding("placement", {
        file,
        entryId,
        tier,
        detail: `${context}: condition on target kind "${targetKind}" — only {secondary, armorQuality} accept condition (parser will reject)`,
      });
    }
    if (!Array.isArray(condition)) {
      addFinding("predicateHygiene", {
        file,
        entryId,
        tier,
        detail: `${context}: condition must be an array`,
      });
    } else {
      for (let i = 0; i < condition.length; i++) {
        const c = condition[i];
        if (!c || typeof c !== "object") {
          addFinding("predicateHygiene", {
            file,
            entryId,
            tier,
            detail: `${context}: condition[${i}] not an object`,
          });
          continue;
        }
        const ck = c.kind;
        if (typeof ck !== "string" || !KNOWN_CONDITION_KINDS.has(ck)) {
          addFinding("predicateHygiene", {
            file,
            entryId,
            tier,
            detail: `${context}: condition[${i}].kind="${ck}" invalid`,
          });
          continue;
        }
        if (ck === "noArmor") continue;
        if (!Array.isArray(c.values) || c.values.length === 0) {
          addFinding("predicateHygiene", {
            file,
            entryId,
            tier,
            detail: `${context}: condition[${i}] (${ck}) missing/empty values[]`,
          });
          continue;
        }
        if (ck === "armorSlot") {
          for (const v of c.values) {
            if (typeof v !== "string" || !KNOWN_ARMOR_SLOTS.has(v)) {
              addFinding("predicateHygiene", {
                file,
                entryId,
                tier,
                detail: `${context}: condition[${i}].values contains invalid slot "${v}" (must be "body" or "plug")`,
              });
            }
          }
        } else if (ck === "armorQuality") {
          for (const v of c.values) {
            if (typeof v === "string")
              noteQualityRef(v, file, entryId, "condition");
          }
        }
      }
    }
  }

  // Strict authoring rule: every authored `armorQuality`-target effect
  // requires a non-empty `condition`. Without it, the effect would mutate
  // every equipped armor piece — which is virtually never the authoring
  // intent. Registry-synthesized effects (in `reference/qualities.*.json`)
  // get a slot condition stamped at load time and are exempt; this lint
  // walks ability/spell/talent/ritual files which don't go through that
  // synthesis path.
  if (
    targetKind === "armorQuality" &&
    !file.includes("qualities.") &&
    (!Array.isArray(condition) || condition.length === 0)
  ) {
    addFinding("placement", {
      file,
      entryId,
      tier,
      detail: `${context}: armorQuality target requires a non-empty condition (would otherwise apply to every equipped piece)`,
    });
  }
}

// ── File-type walkers ──

/**
 * Lints for nested action ids on specialAttacks / reactions
 * (ADR-014, Item 9):
 *
 *   1. Each entry must carry a non-empty string `id`.
 *   2. Within a single tier's array, ids must be unique. The engine's
 *      collection step is `Map.set` which would silently drop dups
 *      anyway, but at the same tier this is always an authoring slip.
 *   3. Across different parent abilities/spells (and across both
 *      en/ru locales — the lint accumulator is global), ids must be
 *      unique. Cross-parent collisions produce non-deterministic-
 *      looking last-trait-processed-wins behaviour at recalc time.
 *
 *   Note: same-id ACROSS TIERS of the same parent is intentional —
 *   that's the rewrite-by-id pattern (master replaces adept replaces
 *   novice). It is not flagged here.
 */
function inspectActionIds(
  file: string,
  parentId: string,
  tier: string,
  field: "specialAttack" | "reaction",
  list: any[],
): void {
  const seenInTier = new Set<string>();
  list.forEach((entry, i) => {
    if (!entry || typeof entry !== "object") return;
    const path = `${parentId}.tiers.${tier}.${field}s[${i}]`;
    const id = entry.id;
    if (typeof id !== "string" || id.length === 0) {
      addFinding("actionIds", {
        file,
        entryId: parentId,
        tier,
        detail: `${path}: missing or empty 'id' (required since ADR-014 Item 9)`,
      });
      return;
    }
    if (seenInTier.has(id)) {
      addFinding("actionIds", {
        file,
        entryId: parentId,
        tier,
        detail: `${path}: duplicate id '${id}' within the same tier (engine would silently dedupe)`,
      });
      return;
    }
    seenInTier.add(id);

    const ownerKey = `${id}|${field}`;
    const owner = actionIdOwners.get(ownerKey);
    if (owner && owner.parentId !== parentId) {
      addFinding("actionIds", {
        file,
        entryId: parentId,
        tier,
        detail: `${path}: id '${id}' also defined by '${owner.parentId}' in ${owner.file} — cross-parent collisions produce undefined recalc order`,
      });
    } else if (!owner) {
      actionIdOwners.set(ownerKey, { file, parentId });
    }
  });
}

/**
 * J.3 per-action shape lint covering three amendment items at once:
 *
 *   Item 1 (inheritance) — optional `damageBonus`/`ignoresArmor`/
 *     `appliesTo` fields must be well-typed. Today these are display-
 *     only (engine runtime resolution deferred), so the lint is the
 *     only thing keeping the catalog honest.
 *   Item 6 (`inflicts[]`) — must be an array of string ids that each
 *     resolve in the global status registry (see Section 11 report).
 *   Item 8 (`isFree`) — must be a boolean and may only be `true` on
 *     actions with `trigger: "manual"` (free reactions are nonsensical;
 *     reactions are out-of-turn by definition).
 */
function inspectAction(
  file: string,
  parentId: string,
  tier: string,
  field: "specialAttack" | "reaction",
  i: number,
  action: any,
): void {
  if (!action || typeof action !== "object") return;
  const path = `${parentId}.tiers.${tier}.${field}s[${i}]`;
  const trigger = action.trigger;

  // Item 8: isFree.
  if (action.isFree !== undefined) {
    if (typeof action.isFree !== "boolean") {
      addFinding("isFree", {
        file,
        entryId: parentId,
        tier,
        detail: `${path}: isFree must be boolean (got ${typeof action.isFree})`,
      });
    } else if (action.isFree === true && trigger !== "manual") {
      addFinding("isFree", {
        file,
        entryId: parentId,
        tier,
        detail: `${path}: isFree=true with trigger="${trigger}" — only manual actions can be free (reactions are out-of-turn already)`,
      });
    }
  }

  // Item 6: inflicts[].
  if (action.inflicts !== undefined) {
    if (!Array.isArray(action.inflicts)) {
      addFinding("inflicts", {
        file,
        entryId: parentId,
        tier,
        detail: `${path}: inflicts must be an array of status ids`,
      });
    } else {
      action.inflicts.forEach((sid: unknown, j: number) => {
        if (typeof sid !== "string" || sid.length === 0) {
          addFinding("inflicts", {
            file,
            entryId: parentId,
            tier,
            detail: `${path}.inflicts[${j}]: not a non-empty string`,
          });
          return;
        }
        noteStatusRef(sid, file, parentId, `${field}.inflicts`);
      });
    }
  }

  // Item 1: inheritance-shape optional fields.
  if (action.damageBonus !== undefined) {
    if (
      typeof action.damageBonus !== "number" ||
      !Number.isFinite(action.damageBonus)
    ) {
      addFinding("inheritance", {
        file,
        entryId: parentId,
        tier,
        detail: `${path}: damageBonus must be a finite number (got ${JSON.stringify(action.damageBonus)})`,
      });
    } else if (
      !Array.isArray(action.appliesTo) ||
      action.appliesTo.length === 0
    ) {
      // damageBonus without appliesTo would apply to every carrying slot —
      // certainly not authoring intent. Amendment §1.1 ties them together.
      addFinding("inheritance", {
        file,
        entryId: parentId,
        tier,
        detail: `${path}: damageBonus=${action.damageBonus} without non-empty appliesTo[] — must scope which weapons the bonus applies to`,
      });
    }
  }
  if (
    action.ignoresArmor !== undefined &&
    typeof action.ignoresArmor !== "boolean"
  ) {
    addFinding("inheritance", {
      file,
      entryId: parentId,
      tier,
      detail: `${path}: ignoresArmor must be boolean (got ${typeof action.ignoresArmor})`,
    });
  }
  if (action.appliesTo !== undefined) {
    if (!Array.isArray(action.appliesTo)) {
      addFinding("inheritance", {
        file,
        entryId: parentId,
        tier,
        detail: `${path}: appliesTo must be an array of WeaponPredicate`,
      });
    } else {
      action.appliesTo.forEach((pred: any, j: number) => {
        if (
          !pred ||
          typeof pred !== "object" ||
          typeof pred.kind !== "string" ||
          !KNOWN_PREDICATE_KINDS.has(pred.kind)
        ) {
          addFinding("inheritance", {
            file,
            entryId: parentId,
            tier,
            detail: `${path}.appliesTo[${j}].kind="${pred?.kind}" invalid`,
          });
          return;
        }
        if (pred.kind === "quality" && Array.isArray(pred.values)) {
          for (const v of pred.values) {
            if (typeof v === "string")
              noteQualityRef(v, file, parentId, `${field}.appliesTo predicate`);
          }
        }
      });
    }
  }

  // Walk inner action.effects[] (already handled at tier level for
  // tier.effects; action.effects is the per-action variant from
  // amendment §1). Reuse inspectEffect for full target/modifier coverage.
  if (Array.isArray(action.effects)) {
    action.effects.forEach((eff: any, j: number) =>
      inspectEffect(eff, file, parentId, `${path}.effects[${j}]`),
    );
  }
}

function walkAbilitiesOrSpells(file: string, data: any[]): void {
  for (const entry of data) {
    if (!entry || typeof entry !== "object") continue;
    const id = entry.id ?? "<no-id>";
    const tiers = entry.tiers ?? {};
    for (const [tierKey, tierVal] of Object.entries(tiers)) {
      if (!tierVal || typeof tierVal !== "object") continue;
      const effects = (tierVal as any).effects;
      if (Array.isArray(effects)) {
        effects.forEach((eff, i) =>
          inspectEffect(eff, file, id, `${id}.tiers.${tierKey}.effects[${i}]`),
        );
      }
      // Check for hardcoded special-attack/reaction shapes (Item 1).
      const specialAttacks = (tierVal as any).specialAttacks;
      if (Array.isArray(specialAttacks)) {
        inspectActionIds(file, id, tierKey, "specialAttack", specialAttacks);
        specialAttacks.forEach((sa: any, i: number) =>
          inspectAction(file, id, tierKey, "specialAttack", i, sa),
        );
        specialAttacks.forEach((sa, i) => {
          if (
            sa &&
            typeof sa === "object" &&
            (sa.damage !== undefined || sa.attackAttribute !== undefined)
          ) {
            addFinding("amendmentBlockers", {
              file,
              entryId: id,
              tier: tierKey,
              detail: `${id}.tiers.${tierKey}.specialAttacks[${i}]: hardcoded damage/attackAttribute — Item 1 will inherit-by-default`,
            });
          }
        });
      }
      const reactions = (tierVal as any).reactions;
      if (Array.isArray(reactions)) {
        inspectActionIds(file, id, tierKey, "reaction", reactions);
        reactions.forEach((r: any, i: number) =>
          inspectAction(file, id, tierKey, "reaction", i, r),
        );
        reactions.forEach((r, i) => {
          if (
            r &&
            typeof r === "object" &&
            (r.damage !== undefined || r.attackAttribute !== undefined)
          ) {
            addFinding("amendmentBlockers", {
              file,
              entryId: id,
              tier: tierKey,
              detail: `${id}.tiers.${tierKey}.reactions[${i}]: hardcoded damage/attackAttribute — Item 1 will inherit-by-default`,
            });
          }
        });
      }
      // Spell-tier per-spell attackAttribute (Item 2 will strip).
      if ((tierVal as any).attackAttribute !== undefined) {
        addFinding("amendmentBlockers", {
          file,
          entryId: id,
          tier: tierKey,
          detail: `${id}.tiers.${tierKey}.attackAttribute=${JSON.stringify((tierVal as any).attackAttribute)} — Item 2 strips per-spell, replaced by character.magicAttribute`,
        });
      }
    }
  }
}

function walkBoonsSinsRituals(file: string, data: any[]): void {
  // Boons/sins MAY carry top-level effects[] per amendment Item 7.
  // Rituals remain flat (no effects[]) until further notice.
  const isRitual = file.startsWith("rituals.");
  for (const entry of data) {
    if (!entry || typeof entry !== "object") continue;
    const id = entry.id ?? "<no-id>";
    if (Array.isArray(entry.effects) && entry.effects.length > 0) {
      if (isRitual) {
        addFinding("rogueFields", {
          file,
          entryId: id,
          detail: `${id}: top-level effects[] on a ritual (spec says flat — rituals don't carry effects). Inspecting anyway:`,
        });
      }
      // Either way, validate the effect contents.
      entry.effects.forEach((eff: any, i: number) =>
        inspectEffect(eff, file, id, `${id}.effects[${i}]`),
      );
    }
    if (entry.tiers !== undefined) {
      addFinding("rogueFields", {
        file,
        entryId: id,
        detail: `${id}: has tiers — boons/sins/rituals are flat per spec`,
      });
    }
  }
}

function walkWeaponsOrArmor(
  file: string,
  data: any[],
  kind: "weapon" | "armor",
): void {
  for (const entry of data) {
    if (!entry || typeof entry !== "object") continue;
    const id = entry.id ?? "<no-id>";
    if (Array.isArray(entry.qualities)) {
      for (const q of entry.qualities) {
        if (typeof q === "string")
          noteQualityRef(q, file, id, `${kind}.qualities[]`);
      }
    }
    if (Array.isArray(entry.effects) && entry.effects.length > 0) {
      // Bespoke effects are allowed but rare per spec. Note them.
      addFinding("rogueFields", {
        file,
        entryId: id,
        detail: `${id}: ${kind}.effects[] populated (${entry.effects.length} entries) — bespoke per ADR-016, verify intent`,
      });
      entry.effects.forEach((eff: any, i: number) =>
        inspectEffect(eff, file, id, `${kind}:${id}.effects[${i}]`),
      );
    }
  }
}

function walkQualities(file: string, data: any[]): void {
  for (const entry of data) {
    if (!entry || typeof entry !== "object") continue;
    const id = entry.id ?? "<no-id>";
    qualityIds.add(id);
    if (Array.isArray(entry.effects)) {
      entry.effects.forEach((eff: any, i: number) =>
        inspectEffect(eff, file, id, `quality:${id}.effects[${i}]`),
      );
    }
  }
}

function walkStatuses(_file: string, data: any[]): void {
  for (const entry of data) {
    if (!entry || typeof entry !== "object") continue;
    const id = entry.id;
    if (typeof id === "string" && id.length > 0) statusIds.add(id);
  }
}

// ── Drive ──

const files = readdirSync(RESOLVED_REF).filter((f) => f.endsWith(".json"));

for (const file of files) {
  const path = join(RESOLVED_REF, file);
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const data = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.entries)
      ? raw.entries
      : null;
  if (!data) {
    addFinding("rogueFields", {
      file,
      entryId: "<root>",
      detail: `${file}: not an array and no .entries[] — unexpected shape`,
    });
    continue;
  }

  if (file.startsWith("abilities.") || file.startsWith("spells.")) {
    walkAbilitiesOrSpells(file, data);
  } else if (
    file.startsWith("boons.") ||
    file.startsWith("sins.") ||
    file.startsWith("rituals.")
  ) {
    walkBoonsSinsRituals(file, data);
  } else if (file.startsWith("weapons.")) {
    walkWeaponsOrArmor(file, data, "weapon");
  } else if (file.startsWith("armor.")) {
    walkWeaponsOrArmor(file, data, "armor");
  } else if (file.startsWith("qualities.")) {
    walkQualities(file, data);
  } else if (file.startsWith("statuses.")) {
    walkStatuses(file, data);
  }
}

// ── Cross-check quality resolution ──

const unresolved = new Map<
  string,
  { file: string; entryId: string; via: string }[]
>();
for (const [id, refs] of qualityRefs) {
  if (!qualityIds.has(id)) unresolved.set(id, refs);
}

// ── Report ──

function header(s: string): void {
  console.log(`\n=== ${s} ===`);
}

function dedupe(items: Finding[]): Finding[] {
  // Locale pairs duplicate everything. Keep one entry per (entryId + detail).
  const seen = new Map<string, Finding>();
  for (const f of items) {
    const key = `${f.entryId}::${f.detail}`;
    if (!seen.has(key)) seen.set(key, f);
  }
  return [...seen.values()];
}

console.log("# Reference Catalog Audit\n");
console.log(`Files scanned: ${files.length}`);
console.log(`Quality registry size: ${qualityIds.size} ids`);
console.log(
  `Total quality references: ${qualityRefs.size} unique ids referenced`,
);

header("1. Tier-marker problems");
const tierFindings = dedupe(findings.tierMarkers!);
if (tierFindings.length === 0) console.log("  (none)");
else
  tierFindings.forEach((f) => console.log(`  [${f.tier ?? "?"}] ${f.detail}`));

header("2. Parser rejections (target/modifier verb compatibility)");
const parserFindings = dedupe(findings.parserRejections!);
if (parserFindings.length === 0) console.log("  (none)");
else parserFindings.forEach((f) => console.log(`  ${f.detail}`));

header("3. Predicate hygiene (appliesTo)");
const predFindings = dedupe(findings.predicateHygiene!);
if (predFindings.length === 0) console.log("  (none)");
else predFindings.forEach((f) => console.log(`  ${f.detail}`));

header("4. Quality-id resolution");
if (unresolved.size === 0) {
  console.log("  All referenced quality ids resolve in the registry.");
} else {
  console.log(`  ${unresolved.size} unresolved id(s):`);
  for (const [id, refs] of unresolved) {
    console.log(
      `    - "${id}" referenced ${refs.length}x — first: ${refs[0]!.file} entry=${refs[0]!.entryId} via ${refs[0]!.via}`,
    );
  }
}

header("5. Flag-name vocabulary (sprawl check)");
console.log(`  ${flagNames.size} distinct flag names used across the catalog:`);
const sortedFlags = [...flagNames].sort();
for (const f of sortedFlags) {
  console.log(`    - ${f}  (${flagOccurrences[f]}x)`);
}

header(
  "6. Amendment blockers (data uses features that require amendment items)",
);
const amendFindings = dedupe(findings.amendmentBlockers!);
if (amendFindings.length === 0) {
  console.log("  (none — all amendment-blocked patterns absent)");
} else {
  // Group by which Item.
  const byItem = new Map<string, Finding[]>();
  for (const f of amendFindings) {
    const m = f.detail.match(/Item (\d+)/);
    const key = m ? `Item ${m[1]}` : "Other";
    if (!byItem.has(key)) byItem.set(key, []);
    byItem.get(key)!.push(f);
  }
  for (const [item, list] of [...byItem.entries()].sort()) {
    console.log(`  ${item}: ${list.length} occurrence(s)`);
    list.slice(0, 10).forEach((f) => console.log(`    - ${f.detail}`));
    if (list.length > 10) console.log(`    ... and ${list.length - 10} more`);
  }
}

header("7. Rogue / unexpected fields");
const rogueFindings = dedupe(findings.rogueFields!);
if (rogueFindings.length === 0) console.log("  (none)");
else rogueFindings.forEach((f) => console.log(`  [${f.file}] ${f.detail}`));

header("8. Action ids (specialAttacks / reactions, ADR-014 Item 9)");
const actionIdFindings = dedupe(findings.actionIds!);
if (actionIdFindings.length === 0) console.log("  (none)");
else actionIdFindings.forEach((f) => console.log(`  ${f.detail}`));

header("9. Placement discipline (Item 12 — appliesTo / condition)");
const placementFindings = dedupe(findings.placement!);
if (placementFindings.length === 0) console.log("  (none)");
else placementFindings.forEach((f) => console.log(`  ${f.detail}`));

header("10. Action inflicts[] (Item 6 — status-id resolution)");
const inflictsFindings = dedupe(findings.inflicts!);
if (inflictsFindings.length === 0 && statusRefs.size === 0) {
  console.log("  (no inflicts[] in catalog)");
} else {
  inflictsFindings.forEach((f) => console.log(`  ${f.detail}`));
  // Status-id resolution sweep.
  const unresolvedStatuses = new Map<
    string,
    { file: string; entryId: string; via: string }[]
  >();
  for (const [id, refs] of statusRefs) {
    if (!statusIds.has(id)) unresolvedStatuses.set(id, refs);
  }
  console.log(
    `  Status registry: ${statusIds.size} ids — ${statusRefs.size} distinct ids referenced via inflicts[]`,
  );
  if (unresolvedStatuses.size > 0) {
    console.log(`  ${unresolvedStatuses.size} unresolved status id(s):`);
    for (const [id, refs] of unresolvedStatuses) {
      console.log(
        `    - "${id}" referenced ${refs.length}x — first: ${refs[0]!.file} entry=${refs[0]!.entryId} via ${refs[0]!.via}`,
      );
    }
  } else if (statusRefs.size > 0) {
    console.log("  All referenced status ids resolve.");
  }
}

header("11. Action isFree (Item 8 — manual-only gate)");
const isFreeFindings = dedupe(findings.isFree!);
if (isFreeFindings.length === 0) console.log("  (none)");
else isFreeFindings.forEach((f) => console.log(`  ${f.detail}`));

header(
  "12. Action inheritance shape (Item 1 — damageBonus/ignoresArmor/appliesTo)",
);
const inheritanceFindings = dedupe(findings.inheritance!);
if (inheritanceFindings.length === 0) console.log("  (none)");
else inheritanceFindings.forEach((f) => console.log(`  ${f.detail}`));

console.log("\n--- end of audit ---");
