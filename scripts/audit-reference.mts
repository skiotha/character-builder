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
const KNOWN_MODIFIER_TYPES = new Set([
  "setBase",
  "addFlat",
  "multiply",
  "cap",
  "remove",
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
};
const flagNames = new Set<string>();
const flagOccurrences: Record<string, number> = {};
const qualityIds = new Set<string>();
const qualityRefs = new Map<
  string,
  { file: string; entryId: string; via: string }[]
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
    // `combat`, `weaponQuality`, and `flag` accept `appliesTo`. For `flag` the
    // engine treats it as documentary metadata for siblings (Item 13).
    if (
      targetKind &&
      targetKind !== "combat" &&
      targetKind !== "weaponQuality" &&
      targetKind !== "flag"
    ) {
      addFinding("predicateHygiene", {
        file,
        entryId,
        tier,
        detail: `${context}: appliesTo on target kind "${targetKind}" — silently stripped by parser`,
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
      addFinding("predicateHygiene", {
        file,
        entryId,
        tier,
        detail: `${context}: condition on target kind "${targetKind}" — only "secondary" / "armorQuality" accept condition (parser strips with warn)`,
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
    addFinding("predicateHygiene", {
      file,
      entryId,
      tier,
      detail: `${context}: armorQuality target requires a non-empty condition (would otherwise apply to every equipped piece)`,
    });
  }
}

// ── File-type walkers ──

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
  // Spec says these are FLAT — should not have effects[]. Surface any that do.
  for (const entry of data) {
    if (!entry || typeof entry !== "object") continue;
    const id = entry.id ?? "<no-id>";
    if (Array.isArray(entry.effects) && entry.effects.length > 0) {
      addFinding("rogueFields", {
        file,
        entryId: id,
        detail: `${id}: top-level effects[] (spec says flat — only abilities/spells carry effects). Inspecting anyway:`,
      });
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

console.log("\n--- end of audit ---");
