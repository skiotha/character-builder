# Authoring Spec — Reference Catalog Effects (Phase 6 / Chunk F)

> Status: **active**. Companion to [data-contracts.md §1.1](data-contracts.md#L146)
> and [ADR-015](decisions/015-typed-effect-targets-final.md).
> Drives the Chunk F bulk authoring pass over `reference/*.{en,ru}.json`.

This document is the single source of truth for **how to fill in an entry**
in any of the eight reference files:

```
reference/abilities.{en,ru}.json
reference/spells.{en,ru}.json
reference/boons.{en,ru}.json
reference/sins.{en,ru}.json
reference/rituals.{en,ru}.json
reference/weapons.{en,ru}.json
reference/armor.{en,ru}.json
reference/qualities.{en,ru}.json
```

It assumes you've read ADR-014 (per-slot combat) and ADR-015 (typed effect
targets). It does **not** repeat the type definitions — see
[`src/rpg-types.mts`](../src/rpg-types.mts) for the authoritative shapes.

## 0. Universal rules

### 0.1 Locale parity (lint-enforced)

`<topic>.en.json` and `<topic>.ru.json` are **structurally identical**.
Every leaf must deep-equal across the two files **except** for the three
allowlisted localized fields:

- `name`
- `description`
- `tags`

These three may differ in length, content, or **presence** (e.g. you may
skip `description` in one locale). Everything else — ids, ordering, all
target/modifier/predicate shapes, weapon `damage`, armor `armor`, quality
lists, etc. — must be byte-identical or
[`test/reference-locale-drift.test.mts`](../test/reference-locale-drift.test.mts)
fails.

**Authoring discipline:** always edit both locale files in lockstep. When
you change structure in `.en.json`, replicate the change in `.ru.json` in
the same commit. The `tags` array in `.ru.json` is a translation of the
`.en.json` tags but may include locale-specific search terms — the lint
does not compare them.

### 0.2 Id stability

Ids are forever. Once a weapon/quality/ability id is committed, sibling
projects (Discord bot, WoW addon) and existing character JSON files
reference it. Renaming an id is a breaking change; treat ids as
opaque keys, not slugs.

### 0.3 Tier-stacking convention (abilities & spells)

A character with `{ id, tier: "master" }` collects effects from
`novice + adept + master`. **Each tier authors only the *new* effects it
introduces.** Higher tiers extend lower ones additively.

- ❌ Don't repeat the novice effect under adept.
- ✅ If adept *replaces* a novice effect, encode the novice version with
  whatever it should reduce to and add a separate effect at adept that
  removes/overrides the relevant target. The engine has no "supersedes"
  primitive — use `addFlat: -X` to undo a numeric bonus, or
  `modifier.type: "remove"` to strike a quality/flag.

### 0.4 Effect-tier markers (`"tier": "A"|"B"|"C"`)

Inside any `effects[]` entry, the optional `"tier"` field is **authoring
metadata**, not engine input. It tells the next reader (you, in two months)
which mechanical layer the entry belongs to:

| Marker | Meaning                                                       | Engine encoded?                   |
| ------ | ------------------------------------------------------------- | --------------------------------- |
| `A`    | Pure stat math (numbers, set-membership, formulas).           | **Yes** — full `target + modifier`. |
| `B`    | Permanent capability the engine surfaces but doesn't resolve (immunities, sensory flags, movement modes). | **Yes** — emitted as `flag` target. |
| `C`    | Pure narrative / GM-adjudicated (rage rules, action economy, reactions, "once per scene"). | **No** — `description` only.      |

Tier C entries **must** still appear in `effects[]` for completeness; they
just carry only `tier`, `description`, and (optionally) a localized
`name`. They have no `target` or `modifier` and the engine ignores them.

### 0.5 The "do not encode" list (Tier C territory)

These belong in narrative / sibling apps, **never** in `target`/`modifier`:

- Character-state preconditions: rage, no-armor, low-health, prone, surprised.
- Per-scene / per-adventure / per-day resource counts.
- Action-economy rules ("as a reaction", "once per turn", "instead of moving").
- **Reactions of any kind.** "As a reaction, X" is always Tier C — the engine has no notion of action economy, so reaction-gated effects don't fire automatically. The `Reaction` derived collection (Q3 below) is a separate, deferred concern.
- Costs payable in experience, corruption, gold.
- Concentration / maintained spells.
- Anything requiring a check the player rolls (Cunning check, Resolute check, etc.) — encode the *result* via flags if the engine cares, never the check itself.

If your effect needs any of the above to "fire", it's Tier C. Write the
mechanic in `description` and let the GM / sibling app handle it.

### 0.6 The localized-field rule

**Engine code MUST NOT branch on `name`, `description`, or `tags`.** If you
find yourself wanting to encode mechanics in a description string, stop and
add a real `target`/`modifier`. Descriptions are for humans only.

---

## 1. Abilities (`abilities.{en,ru}.json`)

### Entry shape

```jsonc
{
  "id": "acrobatics",                    // stable, kebab-case
  "name": "Acrobatics",                  // localized
  "category": "ability",                 // literal "ability"
  "description": "Agility, maneuverability, and gymnastic techniques…",  // localized
  "tags": ["mobility", "defense", "quick"],  // localized; free-form
  "source": "03-reference/abilities",    // pointer to RPG vault path
  "tiers": {
    "novice": { "description": "...", "effects": [ /* new effects */ ] },
    "adept":  { "description": "...", "effects": [ /* new effects only */ ] },
    "master": { "description": "...", "effects": [ /* new effects only */ ] }
  }
}
```

### Effect entry shape (used inside any `effects[]`)

```jsonc
{
  "tier": "A" | "B" | "C",              // authoring marker, see §0.4
  "name": "Optional human label",        // localized; usually omitted
  "description": "What this does in prose.",  // localized; required for Tier C, recommended otherwise
  "target":   EffectTarget,              // required for Tier A and B
  "modifier": EffectModifier,            // required for Tier A and B
  "appliesTo": [WeaponPredicate, ...]    // optional; only meaningful for combat / weaponQuality targets
}
```

The five `EffectTarget` kinds and worked examples are in §7.

### Tier-A worked example — flat secondary bonus

> "Iron Fist (novice): +2 to attacks with unarmed strikes." Encoded as a
> per-slot combat bonus restricted to the natural weapon.

```jsonc
{
  "tier": "A",
  "description": "+2 bonus damage with unarmed strikes.",
  "target":   { "kind": "combat", "field": "bonusDamage" },
  "modifier": { "type": "addFlat", "value": 2 },
  "appliesTo": [
    { "kind": "id", "values": ["natural_weapon"] }
  ]
}
```

### Tier-A worked example — formula override (attack attribute swap)

> "Marksmanship (novice): use Accurate instead of Quick for ranged
> attacks."

```jsonc
{
  "tier": "A",
  "description": "Use Accurate for ranged attack rolls.",
  "target":   { "kind": "combat", "field": "attackAttribute" },
  "modifier": { "type": "setBase", "value": "accurate" },
  "appliesTo": [
    { "kind": "type", "values": ["ranged", "thrown"] }
  ]
}
```

`combat.attackAttribute` accepts **only** `setBase`. `addFlat`, `multiply`,
`cap`, `remove` are parser-rejected (ADR-015 §3b).

### Tier-A worked example — weapon-quality grant

> "Polearm Mastery (adept): your polearms gain the `reach` quality."

```jsonc
{
  "tier": "A",
  "description": "Your polearms gain reach.",
  "target":   { "kind": "weaponQuality", "quality": "reach" },
  "modifier": { "type": "addFlat", "value": 1 },
  "appliesTo": [
    { "kind": "type", "values": ["polearm"] }
  ]
}
```

For `weaponQuality` / `armorQuality` / `flag` targets, **`addFlat: 1`
means "add to the set", `remove` means "strike from the set"** — the
numeric value is ignored (ADR-015 §3a). `setBase` / `multiply` / `cap`
are parser-rejected on these targets.

### Tier-A worked example — armor-quality removal

> "Acrobatics (adept): you may use combat heels as if they lacked the
> `unwieldy` quality." (Today this is encoded as a `weaponQuality` remove
> because heels are weapons.)

```jsonc
{
  "tier": "A",
  "description": "Use heels without the unwieldy penalty.",
  "target":   { "kind": "weaponQuality", "quality": "unwieldy" },
  "modifier": { "type": "remove" },
  "appliesTo": [
    { "kind": "id", "values": ["heels"] }
  ]
}
```

For armor instead of a weapon, swap `weaponQuality` → `armorQuality` and
drop `appliesTo` (armor-quality scope is implicit — body or plug per the
target's optional `slot` field; default `body`).

### Tier-B worked example — capability flag

> "Acrobatics (novice): may move past enemies without provoking free
> attacks." Engine surfaces it; sibling apps act on it.

```jsonc
{
  "tier": "B",
  "description": "Move freely past enemies without provoking free attacks.",
  "target":   { "kind": "flag", "name": "freeAttackImmunity" },
  "modifier": { "type": "addFlat", "value": 1 }
}
```

Flag names are **shared global vocabulary**. Before inventing a new flag,
check [`EffectFlag` in src/rpg-types.mts](../src/rpg-types.mts) for the
existing set. If you add a new one, append it to that union in the same
commit. (The current set is a placeholder; Chunk F is expected to expand
it.)

### Tier-A worked example — special attack promotion

A `SpecialAttack` is just an `Action` whose `trigger === "manual"`. They
are derived collections, not raw effects, so they live alongside `effects`
on the tier — but in their own array. **Schema TBD pending the cross-topic
question in §10.** Until then, encode special attacks as Tier C narrative
descriptions; we'll back-fill them in a follow-up pass once the wire shape
is locked.

### Tier-A worked example — reaction promotion

Same as above; `Reaction` is `Action` with any non-`manual` trigger. Same
deferral.

### Tier-C worked example

```jsonc
{
  "tier": "C",
  "description": "You may cross spaces occupied by an enemy if you can slip through or leap over, but you cannot end your movement there."
}
```

No `target`, no `modifier`. Engine ignores; sibling apps render it as a
rule note.

---

## 2. Spells (`spells.{en,ru}.json`)

### Entry shape

Identical to abilities (§1) with two deltas:

- `category` is `"spell"`.
- `source` is `"03-reference/spells"`.

### Spell-tier extra fields (when the spell deals damage)

A spell tier may carry **direct combat metadata** (ADR-014 §"Spells"):

```jsonc
{
  "tiers": {
    "novice": {
      "description": "...",
      "attackAttribute": "resolute",      // PrimaryAttributeName, optional
      "damage": 6,                        // number, optional
      "trigger": "manual",                // TriggerKind, optional
      "effects": [ /* same shape as abilities */ ]
    }
  }
}
```

These three fields belong on the **spell tier**, not on the spell root,
and not in any parallel file. There is **no** `cost` field — sibling apps
compute corruption from `traditions` vs spell tags.

If a spell does no damage and has no triggered behaviour, omit all three.

---

## 3. Boons (`boons.{en,ru}.json`)

### Entry shape (locked — flat, no `effects[]`)

```jsonc
{
  "id": "cartographer",
  "name": "Cartographer",                  // localized
  "category": "boon",                      // literal "boon"
  "tags": ["boon", "profession"],          // localized; free-form
  "levels": 3,                             // total ranks the character can buy
  "description": "..."                     // localized; covers all ranks (more ranks = more of the same)
}
```

Boons are non-combat narrative characteristics. The engine does not
resolve them, and most carry only one rank doing one thing (multi-rank
boons are typically just "more of the same number"). Adding a per-rank
`effects[]` shape would be authoring overhead with zero engine payoff —
so the catalog stays flat.

If a real engine-relevant boon ever appears, we'll add `effects[]` (and
if needed, a `ranks` object) at that point. **YAGNI for now.**

---

## 4. Sins (`sins.{en,ru}.json`)

Identical to boons (§3), with `category: "sin"`. Same flat shape, same
rationale — sins are non-combat narrative constraints.

---

## 5. Rituals (`rituals.{en,ru}.json`)

### Entry shape (locked — flat, no `effects[]`)

```jsonc
{
  "id": "form",
  "name": "Form",                          // localized
  "category": "ritual",                    // literal "ritual"
  "tags": ["magic", "transformation"],     // localized
  "description": "..."                     // localized
}
```

Rituals are grandiose mystical activities that can't be expressed in
combat terms. The engine has no use for them. Same YAGNI rationale as
boons — flat shape, no `effects[]`, no per-level structure.

(Characters still store `{ id, level: number }` per
[data-contracts.md §1.2](data-contracts.md#L233); the catalog just
doesn't enumerate per-level mechanics because there are none the engine
would consume.)

---

## 6. Weapons & Armor (`weapons.{en,ru}.json`, `armor.{en,ru}.json`)

### Weapon entry shape

```jsonc
{
  "id": "two_handed_sword",                 // stable, snake_case
  "name": "Two-Handed Sword",               // localized
  "description": "Optional flavour text.",   // NEW in Chunk F, localized, optional
  "type": "heavy",                          // weapon type — see "Canonical vocabularies" in data-contracts.md
  "damage": 10,
  "cost": 50,                               // display-only; engine ignores. Sibling apps may surface it.
  "qualities": ["precise", "versatile"],    // every id must resolve in qualities.{en,ru}.json
  "effects": []                             // bespoke one-offs ONLY (§6.1)
}
```

### Armor entry shape

```jsonc
{
  "id": "embroidered_silk",
  "name": "Embroidered Silk",
  "description": "Optional flavour text.",   // NEW, localized, optional
  "slot": "body" | "plug",
  "armor": 4,                                // mitigation — feeds secondary.armor
  "cost": 10,                                // display-only; engine ignores.
  "qualities": ["hampering", "flexible"],    // every id must resolve in qualities.{en,ru}.json
  "effects": []                              // bespoke one-offs ONLY (§6.1)
}
```

There is **no** `tags` field on weapons or armor (per Chunk F decision —
items aren't searched in isolation from what equips them).

### 6.1 Item-level `effects[]` — bespoke only

After the quality registry lands (Chunk F.0), **standard mechanical
effects must live in [qualities.{en,ru}.json](#L0)**, not on items. The
`effects[]` field on a weapon or armor entry is reserved for genuinely
unique magic items — e.g. "the Sword of Smiting Dragons grants +5 damage
specifically against `dragon`-type creatures", which can't be expressed as
a reusable quality.

For the bulk pass: leave `effects: []` on every weapon and armor entry
unless you're explicitly authoring a one-of-a-kind magic item. All
mechanical contribution from `qualities[]` happens through the registry.

---

## 7. Qualities (`qualities.{en,ru}.json`) — registry of canonical effects

### Entry shape

```jsonc
{
  "id": "fortified",                        // stable, snake_case
  "name": "Fortified",                      // localized
  "description": "+1 to wearer's armor.",   // localized
  "effects": [                              // ResolvedEffect[]; IDENTICAL across en/ru
    {
      "target":   { "kind": "secondary", "stat": "armor" },
      "modifier": { "type": "addFlat", "value": 1 }
    }
  ]
}
```

### Authoring rules

- `id` is globally unique across the registry. No weapon/armor split — a
  single namespace (ADR-016).
- `name` and `description` are the only fields that may differ between
  locales. Lint enforces.
- `effects[]` may be `[]` for purely-flavour qualities (e.g. `own`).
- **Implicit scoping** (do not write `appliesTo` on registry effects):
  - When a **weapon** carries the quality, the engine appends the
    registry's effects with implicit `appliesTo = [{ kind: "id", values: [<weapon.id>] }]` — i.e. they apply only to the slot carrying that weapon.
  - When **armor** carries the quality, the engine appends the registry's
    effects globally (mirrors the existing `armor.body.effects[]` /
    `armor.plug.effects[]` semantics).
- Parametric qualities use an `_N` suffix and are independent entries:
  `fortified`, `fortified_2`, `fortified_3` are three separate ids with
  three separate registry rows.
- Engine throws on unknown ids — every id mentioned by any
  `weapons.qualities[]` or `armor.qualities[]` must have a registry entry.

### Worked examples

#### Flat secondary bonus on armor

```jsonc
{
  "id": "fortified",
  "name": "Fortified",
  "description": "+1 to wearer's armor.",
  "effects": [
    {
      "target":   { "kind": "secondary", "stat": "armor" },
      "modifier": { "type": "addFlat", "value": 1 }
    }
  ]
}
```

#### Flat damage bonus on a weapon

```jsonc
{
  "id": "deep_wounds",
  "name": "Deep Wounds",
  "description": "+1 to bonus damage with this weapon.",
  "effects": [
    {
      "target":   { "kind": "combat", "field": "bonusDamage" },
      "modifier": { "type": "addFlat", "value": 1 }
    }
  ]
}
```

(No `appliesTo` — engine adds the per-weapon scope automatically.)

#### Pure flavour

```jsonc
{
  "id": "own",
  "name": "Innate",
  "description": "This weapon cannot be disarmed.",
  "effects": []
}
```

#### Parametric

```jsonc
{ "id": "hampering",   "name": "Hampering",   "description": "−1 Defense.", "effects": [ /* −1 secondary.defense */ ] },
{ "id": "hampering_2", "name": "Hampering 2", "description": "−2 Defense.", "effects": [ /* −2 secondary.defense */ ] }
```

Two entries; the magnitude is part of the id.

---

## 8. `EffectTarget` kinds — quick reference

Each kind with the minimum required shape and a real-data example. See
[`src/rpg-types.mts`](../src/rpg-types.mts) for the canonical TypeScript.

### `secondary`

```jsonc
{ "kind": "secondary", "stat": "armor" }
// stat ∈ { "toughness", "defense", "armor", "painThreshold", "corruptionThreshold", "corruptionMax" }
```

Modifier verbs: `addFlat` | `multiply` | `cap`. Not `setBase`, not `remove`.

### `combat`

```jsonc
{ "kind": "combat", "field": "bonusDamage" }
// field ∈ { "attackAttribute", "baseDamage", "bonusDamage" }
```

- `attackAttribute`: `setBase` only. Value is a `PrimaryAttributeName`
  (`"accurate"`, `"cunning"`, `"discreet"`, `"alluring"`, `"quick"`,
  `"resolute"`, `"vigilant"`, `"strong"`).
- `baseDamage` / `bonusDamage`: `addFlat` | `multiply` | `cap`. Not `setBase`.

`appliesTo: WeaponPredicate[]` is required when the effect should only
fire for some weapons; omit (or use `[{ kind: "any" }]`) for "every slot".

### `weaponQuality`

```jsonc
{ "kind": "weaponQuality", "quality": "reach" }
```

Modifier: `addFlat` (any value, ignored — means "add to set") **or**
`remove`. Use `appliesTo` to scope.

### `armorQuality`

```jsonc
{ "kind": "armorQuality", "quality": "fortified" }
// optional: "slot": "body" | "plug" (default "body")
```

Modifier: `addFlat` ("add to set") or `remove`. No `appliesTo` — armor
slot is the only scoping dimension.

### `flag`

```jsonc
{ "kind": "flag", "name": "darkvision" }
```

Modifier: `addFlat` ("set the flag") or `remove`. `name` must be a
member of the `EffectFlag` union in
[`src/rpg-types.mts`](../src/rpg-types.mts) — extend the union if you add
a new one.

---

## 9. `WeaponPredicate` — quick reference

`appliesTo` is an **AND-composed** array of predicates. Within a single
predicate, `values[]` is **OR-composed**.

```jsonc
[
  { "kind": "type", "values": ["heavy", "polearm"] },     // weapon is heavy OR polearm
  { "kind": "quality", "values": ["composite"] }          // AND has the composite quality
]
```

Four kinds:

| `kind`    | Semantics                                                      |
| --------- | -------------------------------------------------------------- |
| `any`     | Always matches. Use as a no-op or default; `values[]` ignored. |
| `type`    | Matches if `weapon.type` is in `values[]`.                     |
| `quality` | Matches if any of `values[]` is in `weapon.qualities[]`.       |
| `id`      | Matches if `weapon.id` is in `values[]`.                       |

There is **no** `subtype` predicate (ADR-015 §3a).

If `appliesTo` is omitted or `[]`, the effect applies to every slot.

---

## 10. Deferred — picked up after the bulk pass

> Tracked in [`.github/plans/phase6-plan.md`](../.github/plans/phase6-plan.md)
> Chunk F follow-up section so we don't lose them.

### `SpecialAttack` / `Reaction` wire shape on tier objects

ADR-014 says these are derived collections distinguished by
`trigger === "manual"`. The intended landing shape is alongside
`effects[]` on a tier:

```jsonc
{
  "tiers": {
    "master": {
      "description": "...",
      "effects": [],
      "specialAttacks": [
        { "name": "Whirlwind", "trigger": "manual", "damage": 4, "attackAttribute": "strong" }
      ],
      "reactions": [
        { "name": "Riposte", "trigger": "onAttacked", "damage": 2 }
      ]
    }
  }
}
```

The registry-side collection lands in Chunk G. **For the bulk pass:**
leave special attacks and reactions as Tier C narrative
`description`-only entries. Back-filled in a dedicated follow-up once
the shape is firm.

### `EffectFlag` cleanup

The current union in [`src/rpg-types.mts`](../src/rpg-types.mts) is a
placeholder. Authors extend it as they go (one flag per commit, paired
with the catalog change that needs it). After the bulk pass, audit the
final set and consolidate near-duplicates.

---

## 11. Authoring workflow checklist

For each entry you author or update:

1. Read the entry's RPG-vault source in
   [`rpg/{en,ru}/03-reference/`](../rpg/) for ground truth.
2. Pick the right tier marker (`A` / `B` / `C`) for each effect.
3. For Tier A/B effects: pick the right `target.kind`. Cross-check the
   modifier verb is allowed on that target (§7 / §8).
4. For combat / weaponQuality effects: write `appliesTo` predicates that
   match the prose ("with polearms" → `{ kind: "type", values: ["polearm"] }`).
5. Mirror the change in the **other** locale file in the same commit.
6. Run `npm test` — locale-drift lint (`test/reference-locale-drift.test.mts`)
   and the engine tests will catch most authoring mistakes.
7. If you used a new flag name, extend `EffectFlag` in
   [`src/rpg-types.mts`](../src/rpg-types.mts) and re-run typecheck.

---

## 12. Things this spec does **not** cover (yet)

- The `EffectFlag` set will expand during F. Today's union is placeholder; cleanup tracked in §10.
- `SpecialAttack` / `Reaction` wire shape on tier objects (§10).
- Validators that resolve registry references at load time — Chunk G.
- Catalog-driven UI pickers — Chunk I.
