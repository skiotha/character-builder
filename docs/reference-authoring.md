# Reference Catalog Authoring Spec

> Companion to [data-contracts.md §1.1](data-contracts.md#L173) and the
> ADRs that lock the wire vocabulary: ADR-014 (per-slot combat), ADR-015
> (typed effect targets), ADR-016 (quality registry).

This document is the single source of truth for **how to fill in an entry**
in any of the nine reference files:

```
reference/abilities.{en,ru}.json
reference/spells.{en,ru}.json
reference/boons.{en,ru}.json
reference/sins.{en,ru}.json
reference/rituals.{en,ru}.json
reference/weapons.{en,ru}.json
reference/armor.{en,ru}.json
reference/qualities.{en,ru}.json
reference/statuses.{en,ru}.json
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
- **Action-economy-gated reactions.** Reactions framed around the action
  economy ("as a reaction, X") are Tier C — the engine has no notion of
  action economy, so they don't fire automatically. Engine-resolvable
  reactions — the typed `Reaction` collection — are a different thing:
  they're `Action`s with a non-`manual` trigger and are specified in §11.
- Costs payable in experience, corruption, gold.
- Concentration / maintained spells.
- Anything requiring a check the player rolls (Cunning check, Resolute check, etc.) — encode the *result* via flags if the engine cares, never the check itself.

If your effect needs any of the above to "fire", it's Tier C. Write the
mechanic in `description` and let the GM / sibling app handle it.

### 0.6 The localized-field rule

**Engine code MUST NOT branch on `name`, `description`, or `tags`.** If you
find yourself wanting to encode mechanics in a description string, stop and
add a real `target`/`modifier`. Descriptions are for humans only.

### 0.7 The opaque-status rule

Mirror of §0.6 for statuses. **Engine code MUST NOT branch on
`Status.name` or `Status.description`.** Statuses are looked up by id
only; their text is display data for humans and sibling apps. If the
engine needs to react to a status, model it as a `flag` target, not as
string-matching on a status row (ADR-016).

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

The eight `EffectTarget` kinds and worked examples are in §9.

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
commit that authors the catalog entry consuming it.

### Tier-A worked example — special attack promotion

A `SpecialAttack` is an `Action` whose `trigger === "manual"`. The wire
shape on tier objects is fully specified in §11; the short version is:
author the entry under the appropriate tier's `specialAttacks[]` array,
repeat the same `id` at a higher tier to override (Backstab pattern),
or use a new id to add a brand-new entry at that tier.

### Tier-A worked example — reaction promotion

Same as above; a `Reaction` is an `Action` with any non-`manual`
trigger, authored under the tier's `reactions[]` array. See §11 for the
canonical fields and inheritance defaults.

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

### Entry shape (mostly flat; optional opportunistic `effects[]`)

```jsonc
{
  "id": "cartographer",
  "name": "Cartographer",                  // localized
  "category": "boon",                      // literal "boon"
  "tags": ["boon", "profession"],          // localized; free-form
  "levels": 3,                             // total ranks the character can buy
  "description": "...",                    // localized; covers all ranks (more ranks = more of the same)
  "effects": []                            // OPTIONAL — see "Opportunistic engine effects" below
}
```

Boons are primarily non-combat narrative characteristics. Most carry
no `effects[]` at all. The engine resolves any that *are* declared
through the same `collectAllEffects` pipeline as traits (looked up via
`registry.lookupTalent(id, level)`).

### Opportunistic engine effects

**Author engine effects on a boon *only when* it produces a typed
observable consequence:**

- A `flag` consumed by combat or another typed effect
  (`fireResistance`, `darkvision`, `trueSight`, `evasion`, …).
- A `secondary` modifier (defense, armor, painThreshold, …).
- A `setBase` on a derived attribute (`magicAttribute`,
  `initiativeAttribute`, `combat.attackAttribute`).
- A `weaponQuality` / `armorQuality` toggle that affects an equipped
  item.

**Rule of thumb:** if removing the boon would change *any* other typed
effect or per-slot calculation's output, author the effect(s). If the
boon is purely narrative ("loved by everyone", "prone to brooding"),
omit `effects` — that is correct, not a gap.

Boons are flat (no per-rank effects); a single `effects[]` array
applies regardless of how many ranks the character has bought. If
ranked engine effects become necessary, revisit the schema.

---

## 4. Sins (`sins.{en,ru}.json`)

Same shape and same opportunistic-effects policy as boons (§3), with
`category: "sin"`. Author `effects[]` only when a sin produces a typed
observable consequence (e.g. a flag the engine or sibling apps
consume, a secondary cap, a combat-relevant downside). Most sins
remain flat narrative entries.

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
  "description": "Optional flavour text.",   // localized, optional
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
  "description": "Optional flavour text.",   // localized, optional
  "slot": "body" | "plug",
  "armor": 4,                                // mitigation — feeds secondary.armor
  "cost": 10,                                // display-only; engine ignores.
  "qualities": ["hampering", "flexible"],    // every id must resolve in qualities.{en,ru}.json
  "effects": []                              // bespoke one-offs ONLY (§6.1)
}
```

There is **no** `tags` field on weapons or armor (items aren't searched
in isolation from what equips them).

### 6.1 Item-level `effects[]` — bespoke only

**Standard mechanical effects live in
[qualities.{en,ru}.json](#L0)**, not on items. The `effects[]` field on
a weapon or armor entry is reserved for genuinely unique magic items —
e.g. "the Sword of Smiting Dragons grants +5 damage specifically against
`dragon`-type creatures", which can't be expressed as a reusable quality.

Leave `effects: []` on every weapon and armor entry unless you're
explicitly authoring a one-of-a-kind magic item. All mechanical
contribution from `qualities[]` flows through the registry.

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

## 8. Statuses (`statuses.{en,ru}.json`) — display-only registry

Statuses are the named conditions an `Action.inflicts[]` array can put
on a target (`bleeding`, `dazed`, `prone`, `stunned`, …). They are
**opaque display tokens**: the engine never branches on their text, and
the catalog never carries effects.

### Entry shape

```jsonc
{
  "id":          "bleeding",                  // stable, snake_case, globally unique
  "name":        "Bleeding",                  // localized
  "description": "The target takes 1 damage at the start of each of their turns until healed."  // localized
}
```

### Authoring rules

- `id` is globally unique across the registry and locale-independent.
- `name` and `description` are the only fields that may differ between
  locales. The locale-drift lint enforces parallel ordering and the same
  id set across `statuses.en.json` and `statuses.ru.json`.
- There is **no** `effects[]`, no `tier`, no `appliesTo`. Statuses are
  not effects — they are labels the engine attaches to targets so
  sibling apps can resolve duration, stacking, and saves.
- `Action.inflicts[]` (§11) carries status ids. Every id mentioned by
  any `inflicts[]` must resolve here; the audit script flags unknowns.
- The engine treats statuses as opaque tokens (ADR-016 / §0.7). If you
  want the engine itself to *react* to a status — e.g. grant `evasion`
  while `prone` — author that as a `flag` target, not as a status row.
- New status: append to **both** `statuses.{en,ru}.json` in the same
  commit that authors the action inflicting it. Same lockstep discipline
  as every other catalog.

---

## 9. `EffectTarget` kinds — quick reference

Each kind with the minimum required shape and a real-data example. See
[`src/rpg-types.mts`](../src/rpg-types.mts) for the canonical TypeScript.

### `primary`

```jsonc
{ "kind": "primary", "stat": "strong" }
// stat ∈ { "accurate", "cunning", "discreet", "appealing", "quick", "resolute", "vigilant", "strong" }
```

Modifier verbs: `addFlat` | `cap`. Not `setBase`, not `multiply`, not
`remove`. Runs in a pre-pipeline phase ahead of `setBase`/formula, so all
downstream stages (secondary formulas, override resolution, per-slot
combat) automatically see the post-effect values.

> **Display semantics.** The post-effect snapshot is written to
> `character.attributes.primaryEffective`, **not** to
> `character.attributes.primary`. The latter remains the player-authored
> 5–15 base and is never mutated by the engine. Read effective values
> from `primaryEffective`; show the difference (`effective − base`) as
> the bonus from effects. `primaryEffective` is server-controlled —
> clients receive it for display but cannot write it.

Worked example — *Exceptional Attribute (strong) +1*:

```jsonc
{
  "id": "exceptional_attribute_strong",
  "tiers": {
    "novice":  { "tier": "A", "target": { "kind": "primary", "stat": "strong" }, "modifier": { "type": "addFlat", "value": 1 } },
    "adept":   { "tier": "A", "target": { "kind": "primary", "stat": "strong" }, "modifier": { "type": "addFlat", "value": 1 } },
    "master":  { "tier": "A", "target": { "kind": "primary", "stat": "strong" }, "modifier": { "type": "addFlat", "value": 1 } }
  }
}
```

`appliesTo` is silently stripped with a warn — primary attributes are
character-level, not slot-level.

### `secondary`

```jsonc
{ "kind": "secondary", "stat": "armor" }
// stat ∈ { "toughness", "defense", "armor", "painThreshold", "corruptionThreshold", "corruptionMax" }
```

Modifier verbs: `addFlat` | `multiply` | `cap`. Not `setBase`, not `remove`.

> **Toughness writes to `.max`.** `secondary.toughness` is the only
> secondary stat with a `{ max, current }` shape. `addFlat` / `multiply`
> / `cap` modifiers on it write to `.max` and leave `.current` untouched.
> A subsequent `clampValues` pass at the end of `recalculate` clamps
> `current` into `[0, max]`. Author `secondary.stat: "toughness"` (NOT
> `"toughness.max"`) — the audit script flags `"toughness.max"` as a
> parser-rejected legacy form.

### `combat`

```jsonc
{ "kind": "combat", "field": "bonusDamage" }
// field ∈ { "attackAttribute", "baseDamage", "bonusDamage" }
```

- `attackAttribute`: `setBase` only. Value is a `PrimaryAttributeName`
  (`"accurate"`, `"cunning"`, `"discreet"`, `"appealing"`, `"quick"`,
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

`appliesTo: WeaponPredicate[]` is **allowed** on flag targets but the
engine treats it as documentary metadata for sibling apps — see
[§9.5 Roll-time modifier passthrough](#95-roll-time-modifier-passthrough).
The engine still adds the flag name to the global character set
unconditionally; sibling apps consume the predicate to decide when the
roll-time bonus actually fires.

### `magicAttribute`

```jsonc
{ "kind": "magicAttribute" }
```

Modifier: `setBase` only — value is a `PrimaryAttributeName`. The default
is `"resolute"`. Resolution is universal max-by-primary with the default
included (ADR-015 §4a), so an override only takes effect when the chosen
attribute's effective value is *strictly greater* than the current best
candidate.

Worked example — *Leader-novice* (shifts spell power to Appealing):

```jsonc
{
  "target":   { "kind": "magicAttribute" },
  "modifier": { "type": "setBase", "value": "appealing" }
}
```

`appliesTo` is silently stripped with a warn — the field is
character-level, not slot-level.

### `initiativeAttribute`

```jsonc
{ "kind": "initiativeAttribute" }
```

Modifier: `setBase` only. Default is `"quick"`. Resolution is identical
to `magicAttribute` (ADR-015 §4a).

Worked example — *Tactics-novice* (shifts initiative to Cunning):

```jsonc
{
  "target":   { "kind": "initiativeAttribute" },
  "modifier": { "type": "setBase", "value": "cunning" }
}
```

---

## 9.5 Roll-time modifier passthrough

The engine derives **static character state** (attributes, secondary stats,
per-slot combat values, the set of active flags and weapon/armor qualities).
It does **not** roll dice and it does **not** model "+N to a roll result"
modifiers — those are sibling concerns (Discord bot, WoW addon).

Two recurring catalog patterns belong on the sibling side:

| Pattern | Where it lives | What siblings do |
| --- | --- | --- |
| `precise` weapon quality (+1 to attack roll **result**, not die size) | Quality registry entry has empty `effects[]`; the id appears in `weapon.qualities[]`. | Add +1 to the attack roll result when the carried weapon has the `precise` quality. |
| `advantage` flag (+2 to attack roll result; sometimes weapon-scoped) | Effect with `target.kind: "flag"`, `name: "advantage"`, optional `appliesTo` predicate. Engine adds `"advantage"` to the flag set; `appliesTo` is preserved verbatim. | Add +2 to the attack roll result when `"advantage"` is in the flag set. If the originating effect carried an `appliesTo` predicate, narrow that bonus to matching weapons only. |

**Rule of thumb:** if the modifier changes a *die roll's result* (not the
die size, base damage, bonus damage, or attack attribute), encode it as
either an empty-effects quality (for weapon-bound modifiers) or as a
`flag` target with optional `appliesTo` (for character-bound, possibly
weapon-scoped modifiers). Document the magnitude in the entry's
`description` so siblings can read it without consulting this spec.

---

## 10. `WeaponPredicate` — quick reference

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

`appliesTo` is engine-evaluated for `combat` and `weaponQuality` targets
(per-slot fanout), and preserved as documentary metadata for `flag`
targets (siblings consume it — see [§9.5](#95-roll-time-modifier-passthrough)).
The parser strips it with a warn for `secondary`, `armorQuality`, and any
future kinds.

---

## 10.5 `condition` — character-level effect gating

`appliesTo` (§10) gates **per-slot combat** effects. For everything else —
`secondary` stats and armor-side `armorQuality` add/remove — use the
optional `condition` field instead. ADR-015 §3f.

`condition` is an **AND-composed** array of `ArmorCondition` entries.
Within an entry, `values[]` is **OR-composed**.

```jsonc
"condition": [
  { "kind": "armorQuality", "values": ["oiled"] },     // any equipped piece carries `oiled`
  { "kind": "armorSlot",    "values": ["plug"] }       // AND the plug slot is non-empty
]
```

Four kinds:

| `kind`         | Semantics                                                                         |
| -------------- | --------------------------------------------------------------------------------- |
| `armorQuality` | Any equipped armor piece carries any of `values[]` (read through `qualitiesEffective`). |
| `armorId`      | Any equipped piece's `id` is in `values[]`.                                       |
| `armorSlot`    | The named slot (`body` and/or `plug`) is non-empty.                               |
| `noArmor`      | Both armor slots are empty.                                                       |

Accepted on these target kinds **only**:

- `secondary` — character-level read against equipped armor.
- `armorQuality` — per-piece read; each condition is evaluated against
  the current `body`/`plug` piece. `armorSlot` matches only when the
  piece's slot is in `values`. `noArmor` always returns false (a piece
  exists — use `secondary` if you want a "no armor at all" rule).

The parser strips `condition` with a warn from any other target kind.

If `condition` is omitted or `[]`, the effect always fires.

### Worked example — *Combat Oils Novice*

> Adds +4 armor, but only when at least one equipped piece is oiled.

```jsonc
{
  "target":    { "kind": "secondary", "stat": "armor" },
  "modifier":  { "type": "addFlat", "value": 4 },
  "condition": [{ "kind": "armorQuality", "values": ["oiled"] }]
}
```

### Worked example — *Demiurge Hands Master*

> Removes `hampering_2`, but only from the plug, and only if the plug
> actually has it.

```jsonc
{
  "target":    { "kind": "armorQuality", "quality": "hampering_2" },
  "modifier":  { "type": "remove" },
  "condition": [
    { "kind": "armorSlot",    "values": ["plug"] },
    { "kind": "armorQuality", "values": ["hampering_2"] }
  ]
}
```

### Authoring rule (lint-enforced)

Any `armorQuality` effect outside `qualities.{en,ru}.json` **must**
carry a `condition`. The audit lint flags missing conditions because
without one the effect is a silent foot-gun (it would fire on every
equipped piece regardless of intent). Registry quality effects are
exempt — the engine auto-stamps them with an implicit
`condition: [{ kind: "armorSlot", values: [<piece>] }]` so a body
piece's quality never bleeds onto the plug.

---

## 11. `SpecialAttack` / `Reaction` wire shape on tier objects

ADR-014 says these are derived collections distinguished by
`trigger === "manual"`. The wire shape on tier objects is:

```jsonc
{
  "tiers": {
    "master": {
      "description": "...",
      "effects": [],
      "specialAttacks": [
        {
          "id": "whirlwind-spin",            // REQUIRED, locale-independent
          "name": "Whirlwind",
          "trigger": "manual",
          "damage": 4,                       // optional — bespoke override; omit to inherit from carrying weapon
          "attackAttribute": "strong",       // optional — bespoke override; omit to inherit
          "damageBonus": 4,                  // optional — flat bonus on top of inherited base (Backstab pattern)
          "ignoresArmor": true,              // optional, manual only — bypasses target armor
          "inflicts": ["bleeding"],          // optional — status ids from reference/statuses.{en,ru}.json
          "isFree": true,                    // optional, manual only — does not consume the action economy
          "appliesTo": [{ "kind": "any" }]    // optional — narrows to matching carried slots (required when damageBonus is set)
        }
      ],
      "reactions": [
        {
          "id": "riposte-counter",
          "name": "Riposte",
          "trigger": "onAttacked",
          "damage": 2,
          "attackAttribute": "quick"
        }
      ]
    }
  }
}
```

**`id` is required and is the rewrite key (ADR-014):** when the
same `id` appears at two tiers of the same parent ability/spell, the
higher tier replaces the lower. Different ids coexist. So to "upgrade"
a novice special attack at the master tier, repeat the same `id` and
edit the other fields:

**Inheritance defaults.** Omit `damage` / `attackAttribute`
when the action should fire with the carrying weapon's own values
(Backstab, Stab, off-hand strikes). Set them only for bespoke actions
that don't care which weapon you carry (Cheap Shot, magic attacks).
Use `damageBonus` for the Backstab pattern (inherit base, add a flat
bonus); the audit lint requires a non-empty `appliesTo` whenever
`damageBonus` is present to scope which slots earn the bonus.

**Status infliction.** `inflicts[]` declares what statuses
the action applies to its **target** on a successful hit. Values must
resolve against `reference/statuses.{en,ru}.json` (the audit script
flags unknown ids). Engine declares only — sibling combat resolvers
own duration, stacking, and saves. Same lifecycle policy as
`EffectFlag` (which describes the *character*, not the *target*).

**Free attacks.** `isFree: true` marks special attacks that
don't consume the action economy (Two Weapons off-hand, Stab, Quick
Reload). Accepted on `trigger: "manual"` only — reactions are already
out-of-band and the flag would be meaningless. **No derived
`combat.freeAttacks` counter** is computed; sibling apps sum free
attacks themselves (typically one per turn, ability-modified).

**Armor-ignoring damage.** `ignoresArmor: true` on `manual`
actions only. Useful for Strangling, Riposte armor-ignoring d6, and
similar bespoke armor-bypassing strikes.

**Predicate scoping.** `appliesTo` on actions uses the same
`WeaponPredicate[]` vocabulary as effects (§10). `[{ "kind": "any" }]`
is the canonical "any carried weapon" form for slot-bound actions;
omit on innate / monster attacks that don't depend on what's carried.

```jsonc
{
  "tiers": {
    "novice": {
      "specialAttacks": [
        { "id": "intrigues-backstab", "name": "Backstab", "trigger": "manual", "damage": 10 }
      ]
    },
    "master": {
      "specialAttacks": [
        { "id": "intrigues-backstab", "name": "Backstab", "trigger": "manual", "damage": 14 }
      ]
    }
  }
}
```

A character with `intrigues@master` ends up with **one** Backstab in
`character.specialAttacks` (the master version). A character at adept
gets the novice version (the registry never serves them the master
entry). To add a brand-new entry at a higher tier, give it a new id:

```jsonc
{
  "tiers": {
    "novice": {
      "specialAttacks": [
        { "id": "sulfur-cascade-scorch", "name": "Scorch", "trigger": "manual", "damage": 6 }
      ]
    },
    "adept": {
      "specialAttacks": [
        { "id": "sulfur-cascade-pyroclasm", "name": "Pyroclasm", "trigger": "manual", "damage": 10 }
      ]
    }
  }
}
```

**Authoring conventions:**

- Prefix the id with the parent ability/spell id (kebab-case) so
  cross-parent collisions are nearly impossible: `intrigues-backstab`,
  `sulfur-cascade-scorch`. The `scripts/audit-reference.mts` lint
  flags missing ids, dups within a tier, and cross-parent collisions.
- `id` is locale-independent — the en/ru locale-drift lint asserts
  parallel entries carry identical ids.
- The registry collection step is in `src/rules/derived.mts`
  (`collectActions`); talents and equipment do **not** contribute
  actions today (artifact authoring is YAGNI).

### `EffectFlag` extension

The `EffectFlag` union in [`src/rpg-types.mts`](../src/rpg-types.mts)
is the live engine vocabulary. Authors extend it as they go — one flag
per commit, paired with the catalog entry that needs it. Engine
consumers of a new flag must be wired in the same change (or be
explicitly noted as a sibling-only concern).

---

## 12. Authoring workflow checklist

For each entry you author or update:

1. Read the entry's RPG-vault source in
   [`rpg/{en,ru}/03-reference/`](../rpg/) for ground truth.
2. Pick the right tier marker (`A` / `B` / `C`) for each effect.
3. For Tier A/B effects: pick the right `target.kind`. Cross-check the
   modifier verb is allowed on that target (§8 / §9).
4. For combat / weaponQuality effects: write `appliesTo` predicates that
   match the prose ("with polearms" → `{ kind: "type", values: ["polearm"] }`).
5. Mirror the change in the **other** locale file in the same commit.
6. Run `npm test` — locale-drift lint (`test/reference-locale-drift.test.mts`)
   and the engine tests will catch most authoring mistakes.
7. If you used a new flag name, extend `EffectFlag` in
   [`src/rpg-types.mts`](../src/rpg-types.mts) and re-run typecheck.

---

## 13. Out of scope

Things deliberately not covered here:

- **Per-character runtime state.** This spec is about authored
  reference data. Character JSON, derived state, and SSE broadcast
  shapes live in [data-contracts.md](data-contracts.md).
- **Registry loader internals.** `src/models/reference.mts` and
  `src/rules/registry.mts` own how files are loaded, merged across
  locales, and validated. Authors only need to know the on-disk
  shape, which is what this doc covers.
- **Catalog-driven UI pickers.** A future client-side pass may surface
  authored catalogs in the character builder UI. Out of scope here —
  this doc only specifies the wire data those pickers would read.

---

## See also

- [ADR-010 — Effect resolution pipeline](decisions/010-effect-resolution-pipeline.md)
- [ADR-014 — Per-slot combat, special attacks & reactions](decisions/014-per-slot-combat-special-attacks.md)
- [ADR-015 — Typed effect targets, final vocabulary](decisions/015-typed-effect-targets-final.md)
- [ADR-016 — Quality registry](decisions/016-quality-registry.md)
- [docs/architecture.md §3.11 — Reference Catalog](architecture.md#311-reference-catalog)
- [docs/data-contracts.md §1.1 — Effect Object](data-contracts.md#11-effect-object)
- [`rpg/` vault](../rpg/) — prose source of truth for rules content
