# Authoring Amendment — Items 12 + 6 + 8 + 7 + 1 (post-Chunk-F sweep)

> Status: **active** for the in-progress authoring sweep (Items 12, 6, 8,
> 7, 1 from
> [`phase6-chunkF-postpass-amendment.md`](../.github/plans/phase6-chunkF-postpass-amendment.md)).
> Sibling to [`authoring-effects.md`](authoring-effects.md). Folded into
> the main spec after the engine / lint / docs work lands.

This amendment covers four orthogonal authoring concerns being applied in
one sweep over `reference/abilities.{en,ru}.json`,
`reference/spells.{en,ru}.json`, `reference/boons.{en,ru}.json`, and
`reference/sins.{en,ru}.json`:

| # | Item | What it adds                                                  |
| - | ---- | ------------------------------------------------------------- |
| 1 | 12   | Explicit `appliesTo`/`condition` discipline                   |
| 2 | 6    | `inflicts: StatusKind[]` on special-attacks / reactions       |
| 3 | 8    | `isFree: true` on free special-attacks                        |
| 4 | 7    | `effects[]` on engine-relevant boons / sins                   |
| 5 | 1    | Inheritance shape on `SpecialAttack` / `Reaction` (data only) |

The engine side of Item 1 (runtime weapon-slot inheritance) is **deferred
to a follow-up chunk.** This sweep locks the wire shape; runtime
inheritance lands separately. `damage` and `attackAttribute` on `Action`
remain optional in TypeScript; the engine continues to treat them as
required-defined for now.

---

## 1. Scoping vocabulary recap (`appliesTo` vs `condition`)

Two scoping mechanisms exist; they are **independent** and serve
**different** layers:

| Mechanism   | Type                  | Scopes                            | Engine reads it on …                              |
| ----------- | --------------------- | --------------------------------- | ------------------------------------------------- |
| `appliesTo` | `WeaponPredicate[]`   | Per-slot weapon fanout            | `combat`, `weaponQuality` (required, evaluated). `flag` (optional, documentary — see §8.5 of the main spec). |
| `condition` | `ArmorCondition[]`    | Character-level armor gate        | `secondary`, `armorQuality` (optional, evaluated). |

Both are AND-list across entries, OR-within `values[]`.
Both follow the convention: `[{ "kind": "any" }]` is the explicit
"matches everything" canonical for `appliesTo`. `condition` has no
"any" sentinel — omit it when no gate is needed.

### Item 12 rule — placement by `target.kind`

| `target.kind`            | `appliesTo`                                | `condition`                          |
| ------------------------ | ------------------------------------------ | ------------------------------------ |
| `combat`                 | **Required, non-empty.** Use `[{ "kind": "any" }]` for "every slot." | **Forbidden.** |
| `weaponQuality`          | **Required, non-empty.** Same rule.        | **Forbidden.**                       |
| `flag`                   | **Optional.** Documentary; see §8.5 of main spec. | **Forbidden.**                |
| `secondary`              | **Forbidden.**                             | **Optional.** Use for armor-gated bonuses (e.g. Soldier). |
| `armorQuality`           | **Forbidden.**                             | **Optional.** Use when the effect should fire only on certain armor pieces. |
| `primary`                | **Forbidden.**                             | **Forbidden.**                       |
| `magicAttribute`         | **Forbidden.**                             | **Forbidden.**                       |
| `initiativeAttribute`    | **Forbidden.**                             | **Forbidden.**                       |

The parser **strips** misplaced `appliesTo`/`condition` with a warning
today (`secondary` and `armorQuality` strip `appliesTo`; non-`secondary`/
non-`armorQuality` strip `condition`). The post-sweep lint will tighten
this to a **rejection** so the catalog itself stays honest.

### Before / after — `combat` with implicit "all slots"

```jsonc
// ❌ BEFORE
{
  "tier": "A",
  "target":   { "kind": "combat", "field": "baseDamage" },
  "modifier": { "type": "addFlat", "value": 1 }
}

// ✅ AFTER — explicit any-predicate
{
  "tier": "A",
  "target":    { "kind": "combat", "field": "baseDamage" },
  "modifier":  { "type": "addFlat", "value": 1 },
  "appliesTo": [{ "kind": "any" }]
}
```

### Before / after — `armorQuality` that should not carry `appliesTo`

```jsonc
// ❌ BEFORE — appliesTo silently stripped by parser
{
  "target":    { "kind": "armorQuality", "quality": "fortified" },
  "modifier":  { "type": "addFlat", "value": 1 },
  "appliesTo": [{ "kind": "any" }]
}

// ✅ AFTER — no appliesTo; default slot is "body"
{
  "target":   { "kind": "armorQuality", "quality": "fortified" },
  "modifier": { "type": "addFlat", "value": 1 }
}

// ✅ AFTER (gated) — only fires when wearing heavy-tagged armor
{
  "target":    { "kind": "armorQuality", "quality": "fortified" },
  "modifier":  { "type": "addFlat", "value": 1 },
  "condition": [{ "kind": "armorQuality", "values": ["heavy"] }]
}
```

### Soldier-Adept as the canonical `armorQuality` + `condition` example

The shipped Soldier-Adept entry is the reference shape:

```jsonc
{
  "tier": "A",
  "target":    { "kind": "armorQuality", "quality": "hampering_2" },
  "modifier":  { "type": "remove" },
  "condition": [{ "kind": "armorQuality", "values": ["hampering_2"] }]
}
```

Three sibling entries for `hampering_2`, `hampering_3`, `hampering_4`.
Each effect is **self-gated** by the same quality it removes — the
condition guarantees the effect only fires on a piece that actually
carries the quality. Cleanest pattern for "remove X if X is present."

### Before / after — `secondary` with an armor gate (new pattern)

```jsonc
// ❌ BEFORE — author wants "+1 defense only when wearing armor" but has no way to say it
{
  "target":   { "kind": "secondary", "stat": "defense" },
  "modifier": { "type": "addFlat", "value": 1 }
}

// ✅ AFTER — gated to "at least one armor piece equipped, any kind"
{
  "target":    { "kind": "secondary", "stat": "defense" },
  "modifier":  { "type": "addFlat", "value": 1 },
  "condition": [{ "kind": "armorSlot", "values": ["body", "plug"] }]
}

// ✅ AFTER — "+1 defense only when WITHOUT armor" (Light Step pattern)
{
  "target":    { "kind": "secondary", "stat": "defense" },
  "modifier":  { "type": "addFlat", "value": 1 },
  "condition": [{ "kind": "noArmor" }]
}
```

### `ArmorCondition` kinds (recap from
[`src/rules/applicator.mts`](../src/rules/applicator.mts))

| `kind`           | Semantics (character-level, on `secondary`)              | Semantics (per-piece, on `armorQuality`)         |
| ---------------- | -------------------------------------------------------- | ------------------------------------------------ |
| `armorQuality`   | Any equipped piece has any of `values[]`.                | The target piece has any of `values[]`.          |
| `armorId`        | Any equipped piece's `id` ∈ `values[]`.                  | The target piece's `id` ∈ `values[]`.            |
| `armorSlot`      | Any listed slot is non-empty.                            | The target piece is in a listed slot.            |
| `noArmor`        | Both `body` and `plug` are empty.                        | Never matches (you can't gate a piece on "no piece"). |

---

## 2. Item 6 — `inflicts: StatusKind[]`

Add an optional `inflicts: string[]` to `Action` (so it appears on
`SpecialAttack` and `Reaction` alike). The vocabulary is **open during
the sweep** — author whatever string the rules text implies; the lint
tightens to a typed union after the sweep, so we can see the real set
before locking it.

### Authoring rule

If the entry's description says the action **applies a condition / status
to its target**, list it in `inflicts[]`. One status per string;
multiple statuses on one action use multiple array entries.

Self-state ("the user becomes enraged", "you gain advantage") is **not**
`inflicts[]` — those are character flags, modelled via `target.kind:
"flag"` on a separate `effects[]` entry, or left as Tier C narrative.

### Recommended starting vocabulary (extend freely)

Seed list to keep ids consistent across the sweep:

```
stun        bleed       prone       choke
poisoned    burning     frozen      blinded
silenced    entangled   frightened  disarmed
```

Use lower-case single words. If a status doesn't fit, invent one
(`pushed`, `grappled`, `disrupted`, etc.) — bring the new entries back
when you present the sweep and we'll fold them into the typed union.

### Examples

```jsonc
// Cheap Shot — bespoke damage + stun on hit
{
  "id": "street-fighting-cheap-shot",
  "name": "Cheap Shot",
  "trigger": "manual",
  "damage": 6,
  "attackAttribute": "quick",
  "inflicts": ["stun"]
}

// Backstab Adept — bleed rider on top of inherited damage
{
  "id": "intrigues-backstab",
  "name": "Backstab",
  "trigger": "manual",
  "damageBonus": 4,
  "inflicts": ["bleed"]
}

// Strangling — multiple statuses, no damage
{
  "id": "strangling-strangle",
  "name": "Strangle",
  "trigger": "manual",
  "inflicts": ["choke", "silenced"]
}

// Reaction — Knock Over on hit
{
  "id": "street-fighting-knock-over",
  "name": "Knock Over",
  "trigger": "onHit",
  "inflicts": ["prone"]
}
```

### Out of scope

- Durations (turns, rounds, "until cleansed"). Defer; sibling apps own
  status lifecycles.
- Save DCs / resist checks. Sibling concern.
- Severity / stacking. Sibling concern.

---

## 3. Item 8 — `isFree: true`

Add optional `isFree?: boolean` to `Action`. **Set only on
`SpecialAttack` (`trigger: "manual"`); omit on reactions** (they're
implicitly free). The post-sweep lint warns if `isFree` appears on a
non-manual trigger.

### Authoring rule

Mark `isFree: true` when the rules text grants the attack as **extra /
free / additional / bonus**, not consuming the character's normal action
or turn slot. Omit otherwise — that *is* the signal that the attack
costs the action.

### Examples

```jsonc
// Two Weapons Adept — free off-hand strike, any weapon
{
  "id": "double-strike-off-hand",
  "name": "Off-hand Strike",
  "trigger": "manual",
  "isFree": true,
  "appliesTo": [{ "kind": "any" }]
}

// Stab (Knife Mastery Adept) — free knife attack, inherits everything
{
  "id": "knife-mastery-stab",
  "name": "Stab",
  "trigger": "manual",
  "isFree": true,
  "appliesTo": [{ "kind": "type", "values": ["short"] }]
}

// Cheap Shot — NOT free, costs the action; isFree omitted
{
  "id": "street-fighting-cheap-shot",
  "name": "Cheap Shot",
  "trigger": "manual",
  "damage": 6,
  "attackAttribute": "quick",
  "inflicts": ["stun"]
}
```

---

## 4. Item 7 — Opportunistic boon / sin effects

Boons and sins are still **flat** entries (no per-rank structure); the
amendment opens the optional root-level `effects?: ResolvedEffect[]`
field, same shape as ability tier `effects[]`. The engine's
`collectAllEffects` already walks talents, so authored boon/sin effects
flow through the recalc pipeline with no engine change.

### Authoring rule of thumb

For each boon/sin, ask:

> If I removed this from the character, would any *typed effect or
> per-slot calculation* produce a different number or set?

- **Yes** → author the effect(s). Expect almost all to be **Tier B**
  (capability flags); rare entries may be **Tier A** (cap on a primary,
  flat secondary tweak).
- **No** → leave it flat. Empty / absent `effects` is the correct
  authoring outcome for ~80% of boons and sins.

Boons/sins **do not** carry `specialAttacks[]` or `reactions[]` — those
belong to abilities/spells exclusively.

### Examples

```jsonc
// Boon: "Fire-touched" — Tier B flag (uses existing fireResistance)
{
  "id": "fire-touched",
  "category": "boon",
  "name": "Fire-touched",
  "description": "Long exposure to flame has hardened your skin against it.",
  "effects": [
    {
      "tier": "B",
      "description": "Resistant to fire damage.",
      "target":   { "kind": "flag", "name": "fireResistance" },
      "modifier": { "type": "addFlat", "value": 1 }
    }
  ]
}

// Boon: "Dark-eyed" — Tier B flag
{
  "id": "dark-eyed",
  "category": "boon",
  "name": "Dark-eyed",
  "description": "You see clearly in low light.",
  "effects": [
    {
      "tier": "B",
      "target":   { "kind": "flag", "name": "darkvision" },
      "modifier": { "type": "addFlat", "value": 1 }
    }
  ]
}

// Sin: "Brittle Bones" — rare Tier A (cap on primary)
{
  "id": "brittle-bones",
  "category": "sin",
  "name": "Brittle Bones",
  "description": "Your frame won't take what others can.",
  "effects": [
    {
      "tier": "A",
      "target":   { "kind": "primary", "stat": "strong" },
      "modifier": { "type": "cap", "value": 12 }
    }
  ]
}

// Boon: "Beloved Storyteller" — narrative only, no effects
{
  "id": "beloved-storyteller",
  "category": "boon",
  "name": "Beloved Storyteller",
  "description": "Strangers warm to you quickly when you spin a tale."
}
```

### Extending `EffectFlag`

If a boon needs a flag that isn't in the
[`EffectFlag` union](../src/rpg-types.mts), bring it back with the
sweep — extend the union in the same commit as the engine/lint/docs
work.

### Out of scope (still)

- **Conditional boons/sins.** ("Only at night," "only when wounded.")
  These need `condition` machinery the boon side doesn't have. Stay
  Tier C narrative for now.
- **Per-rank boons/sins.** Locked in Chunk F as flat. If a real
  multi-rank engine-relevant boon emerges, revisit the schema then.

---

## 5. Item 1 — Special-attack / reaction inheritance (authoring shape)

Today every `SpecialAttack` / `Reaction` requires `damage` and
`attackAttribute` to be present at runtime, even when both inherit from
the carrying weapon. The amendment makes both fields **optional at the
authoring layer** and introduces three new optional fields. The engine
side that resolves inheritance is deferred.

### New `Action` field set (authoring view)

```ts
interface Action {
  id: string;
  name: string;
  trigger: TriggerKind;
  description?: string;

  // ── Slot binding (reuses appliesTo, not weaponFilter) ────────
  // If set, the action binds to slots whose weapon matches every
  // predicate (AND-list, OR-within values[]). If unset, the action
  // is bespoke and does not inherit from any slot (see "Bespoke vs
  // inheriting" below).
  appliesTo?: WeaponPredicate[];

  // ── Bespoke overrides (optional; omit to inherit) ────────────
  damage?: number;                          // override base damage
  attackAttribute?: PrimaryAttributeName;   // override attack attribute
  damageBonus?: number;                     // ADD on top of inherited base
  ignoresArmor?: boolean;                   // bypass target armor

  // ── Item 6 / 8 fields ────────────────────────────────────────
  inflicts?: string[];                      // typed union after sweep
  isFree?: boolean;                         // SpecialAttack only

  // ── Existing ────────────────────────────────────────────────
  effects?: ResolvedEffect[];
}
```

### Bespoke vs inheriting

There are **three** canonical authoring shapes; pick the one that
matches the rules text and don't mix them.

**A. Pure inherit (bound to a weapon type / quality).** No `damage`,
no `attackAttribute`; required `appliesTo`.

```jsonc
{
  "id": "knife-mastery-stab",
  "name": "Stab",
  "trigger": "manual",
  "isFree": true,
  "appliesTo": [{ "kind": "type", "values": ["short"] }]
}
```

**B. Inherit + bonus.** No `damage`, optional `damageBonus`,
optional `attackAttribute` override; required `appliesTo`.

```jsonc
{
  "id": "intrigues-backstab",
  "name": "Backstab",
  "trigger": "manual",
  "damageBonus": 4,
  "inflicts": ["bleed"],
  "appliesTo": [{ "kind": "any" }]
}
```

(Adept rewrites with `damageBonus: 8` at master tier under the same
`id` — Item 9 dedupe handles the supersession.)

**C. Fully bespoke.** Both `damage` and `attackAttribute` set;
**no `appliesTo`** (bespoke actions don't bind to a slot).

```jsonc
{
  "id": "street-fighting-cheap-shot",
  "name": "Cheap Shot",
  "trigger": "manual",
  "damage": 6,
  "attackAttribute": "quick",
  "inflicts": ["stun"]
}
```

### Spell-specific: no `attackAttribute` on damaging spells

Spells route their attack attribute through `character.magicAttribute`
(engine-resolved, defaults to `resolute`, overridden by Item 2). **Do
not author `attackAttribute` on a damaging spell's `SpecialAttack` /
`Reaction`** — the G2.D sweep removed all 25 such entries; do not
re-introduce them.

```jsonc
// Damaging spell — fixed damage, no attackAttribute
{
  "id": "sulfur-cascade-pyroclasm",
  "name": "Pyroclasm",
  "trigger": "manual",
  "damage": 8,
  "inflicts": ["burning"]
}
```

### Reaction example with armor bypass

```jsonc
{
  "id": "fencing-riposte",
  "name": "Riposte",
  "trigger": "onAttacked",
  "damage": 6,
  "attackAttribute": "quick",
  "ignoresArmor": true
}
```

### Authoring stop conditions

The lint will flag these as authoring errors after the sweep:

| Pattern                                                                 | Why it's wrong                                                     |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `damage` + `attackAttribute` + `appliesTo`                              | Bespoke + slot-bound is incoherent. Pick one: drop `appliesTo` (bespoke) or drop `damage`/`attackAttribute` (inheriting). |
| `damageBonus` without `appliesTo`                                       | Bonuses only make sense applied to an inherited base — bind the action. |
| `attackAttribute` on a damaging spell action                            | Spells route through `character.magicAttribute`. Remove the field. |
| `isFree` on a non-`manual` trigger                                      | Reactions are implicitly free; the field is misleading.            |
| `inflicts: []`                                                          | Empty array is meaningless; omit the field entirely instead.       |

### Engine deferral note

The runtime fallback (`if damage unset → look up slot.baseDamage`) does
**not** ship in this sweep. After the sweep, engine code that consumes
`SpecialAttack` / `Reaction` will still see `damage` and
`attackAttribute` populated on every entry it currently consumes —
because today every existing entry has them. Newly-authored
"inheriting" entries (shape A and B) will lack those fields; engine
code that needs them today will skip those entries until the
inheritance-resolution chunk lands. Make sure the authoring step
doesn't introduce inheriting entries the engine *already* tries to
read end-to-end — i.e. if you remove `damage`/`attackAttribute` from
an entry that worked before, double-check it isn't currently consumed
somewhere downstream.

In practice this affects only abilities whose
`specialAttacks[]` / `reactions[]` arrays are already populated and
used. Newly-authored entries (the bulk of the sweep) are free game.

---

## 6. Sweep workflow

1. **Walk each file** (`abilities`, `spells`, `boons`, `sins`) in
   lockstep across `.en.json` and `.ru.json`.
2. **Apply Item 12 first** — every existing `combat` /
   `weaponQuality` effect gets an explicit `appliesTo`; every existing
   `armorQuality` / `secondary` / `primary` / `magicAttribute` /
   `initiativeAttribute` effect gets `appliesTo` **removed** if
   present; armor-gating moves to `condition`.
3. **Then Items 6 + 8** on `specialAttacks[]` / `reactions[]` arrays
   already authored. Add `inflicts[]` and `isFree: true` as the rules
   text dictates.
4. **Then Item 1** — for newly-authored inheriting actions, omit
   `damage` / `attackAttribute` and add `appliesTo`. For existing
   bespoke actions, keep both and remove `appliesTo` if it crept in.
5. **Finally Item 7** — walk every boon and sin; for each, apply the
   rule-of-thumb test and either author `effects[]` or leave it flat.
6. **Locale parity** — every structural change happens in both `.en`
   and `.ru` in the same commit.

### Things to bring back when presenting the sweep

- Final `StatusKind` vocabulary (the union we lock).
- Any new `EffectFlag` entries surfaced by boon authoring.
- Any new `inflicts` strings outside the seed vocabulary (we may keep
  or rename).
- Any entries you weren't sure how to author — leave a `// REVIEW`
  JSONC comment in a scratch file or callout, not in the JSON itself.

After the sweep lands, the engine + lint + docs work proceeds as one
chunk: parser tightening on `appliesTo`/`condition`, `StatusKind`
typed union, `Action` shape changes in `src/rpg-types.mts`,
`scripts/audit-reference.mts` extensions, `EffectFlag` extension,
and merging this amendment back into [`authoring-effects.md`](authoring-effects.md).
