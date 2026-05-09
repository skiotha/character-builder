# Phase 6 — Post-Chunk-F Amendment Plan

> **Status:** Partially implemented. Items here were surfaced *during* Chunk F
> authoring; the resolution is locked, the implementation was deferred so
> authoring wasn't disrupted by churning types/schema/engine.
>
> Each item carries its own `### Status` section. As of 2026-05-07, shipped:
> Item 13 (2026-05-06), Item 10 (2026-05-06; primaryEffective follow-up
> 2026-05-07), Item 11 (2026-05-06). All other items remain deferred.
>
> **Connection to `phase6-plan.md`.** This file is the staging ground for
> what will become Chunk G's amendment work. Items are pulled into the main
> plan as they ship — see `phase6-plan.md` Chunk F for the rolling progress
> log and Chunk G for the scheduled implementation order.

When ready, copy the relevant items into `phase6-plan.md` as concrete chunks
(likely chunk G or a dedicated F+1).

Cross-references:

- [`docs/authoring-effects.md`](../../docs/authoring-effects.md) — current authoring spec (Chunk F)
- [`docs/decisions/014-per-slot-combat-special-attacks.md`](../../docs/decisions/014-per-slot-combat-special-attacks.md) — ADR-014 (will be amended)
- [`docs/decisions/015-typed-effect-targets-final.md`](../../docs/decisions/015-typed-effect-targets-final.md) — ADR-015 (will be amended)
- [`docs/data-contracts.md`](../../docs/data-contracts.md) — schema contract (will be amended)
- [`src/rpg-types.mts`](../../src/rpg-types.mts) — type home for all changes

---

## Item 1 — Special Attacks & Reactions: inherit-by-default shape

### Problem

The original `SpecialAttack` / `Reaction` shape (ADR-014) requires
`damage: number` and `attackAttribute: PrimaryAttributeName` on every entry.
That model breaks down once we look at real abilities:

- **Stab** (Knife Mastery Adept) — "extra knife attack." It should use the
  carried knife's own `damage`, `attackAttribute`, and pick up any `bonusDamage`
  effects (`Smoke and Mirrors` etc.) targeting that weapon. Hard-coding
  `damage: 6, attackAttribute: "quick"` ignores the slot and breaks composition.
- **Backstab** (Intrigues) — uses the carried weapon's base damage *plus* a
  separate bonus (`+d4`, `+d8` at master). The current shape can't say "inherit
  base damage, add a flat bonus."
- **Cheap Shot** (Street Fighting Novice) — fixed `d6`, fixed `quick`. Doesn't
  care which weapon you carry. Hard-coded values *are* correct here.
- **Magic / spell attacks** — fixed damage, fixed magic-attribute (see Item 2).
  Hard-coded values also correct.

### Resolution

Make slot inheritance the default. Add an optional weapon filter for
slot-bound attacks. Add an optional damage bonus for the Backstab pattern.
Override fields stay optional and only appear when the entry truly is bespoke.

### Wire shape (proposed)

```ts
type SpecialAttack = {
  name: string;
  description?: string;
  trigger: "manual";

  // ── Inheritance / scoping ──────────────────────────────────────
  // If `weaponFilter` is set, the attack is bound to slots whose
  // weapon matches every predicate (AND-list, OR within `values[]`).
  // If unset and `damage`/`attackAttribute` are unset, the attack is
  // innate (engine treats it like a virtual weapon — see Item 2 for
  // the magic case).
  weaponFilter?: WeaponPredicate[];

  // ── Bespoke overrides (optional) ───────────────────────────────
  damage?: number;                   // override base damage (Cheap Shot, magic)
  attackAttribute?: PrimaryAttributeName; // override attack attr (Cheap Shot)
  damageBonus?: number;              // ADD on top of inherited base (Backstab)
  ignoresArmor?: boolean;            // bypass target armor (e.g. Strangling, Riposte armor-ignoring d6)
  // Future: damageMultiplier?, etc. — only when authored.
};

type Reaction = SpecialAttack & {
  trigger: Exclude<TriggerKind, "manual">;
};
```

Resolution order at runtime:

1. If `damage` is set → use it. Else inherit from matched weapon.
2. If `attackAttribute` is set → use it. Else inherit.
3. If `damageBonus` is set → add it after inheritance.

### Authoring examples

```jsonc
// Stab — inherit everything from the equipped knife
{
  "name": "Stab",
  "trigger": "manual",
  "weaponFilter": [{ "kind": "type", "values": ["short"] }]
}

// Backstab — inherit base, add bonus die value
{
  "name": "Backstab",
  "trigger": "manual",
  "damageBonus": 4
  // weaponFilter omitted — works with whatever you carry; advantage gating is narrative
}

// Cheap Shot — fully bespoke, no inheritance
{
  "name": "Cheap Shot",
  "trigger": "manual",
  "damage": 6,
  "attackAttribute": "quick"
}
```

### Affected code

- `src/rpg-types.mts` — change `SpecialAttack` / `Reaction` (relax required fields, add `weaponFilter`/`damageBonus`).
- Validation/sanitization in `src/models/character.mts` — these are derived (per ADR-014 §recalc), so likely no schema change. Confirm they remain non-writable.
- Engine: at the moment `deriveCombatSlots` already produces per-slot baseDamage/attackAttribute. The engine may need a helper that **resolves a SpecialAttack against the character's slots** — produces zero or more *resolved* special attacks (one per matching slot). Sibling apps consume the resolved list.
  - Open sub-question (defer until implementation): does the engine emit `validSlots` per attack, or does it pre-flatten? Earlier discussion landed on "do option #1, not #2" — i.e., pre-flatten is OUT. Engine reports per-slot membership only if needed; otherwise sibling apps walk slots themselves.
- Authoring pass cleanup: re-author Stab, Backstab, and any other slot-bound attacks already written with hardcoded `damage`/`attackAttribute` in `reference/abilities.{en,ru}.json`. Cheap Shot and innate / monster attacks stay as-is.

### Out of scope (per user, "Q3 leave both out")

- Engine pre-resolving `validSlots[]` on the character object.
- Engine inlining slot-resolved damage values onto special attacks at recalc time.

---

## Item 2 — `magicAttribute` derived character field

**Status:** ✅ Implemented (G2.B — 2026-05-08). `magicAttribute: PrimaryAttributeName` on `Character`, schema entry with `ui.hidden: true`, `EffectTarget` extended with `{ kind: "magicAttribute" }` (parser accepts `setBase` only, rejects all numeric verbs and `remove`, strips `appliesTo` with warn). `deriveMagicAttribute` runs after primary phase and before secondary formulas; resolution uses the universal `resolveSetBase` helper (Item 5). *Leader-novice* re-authored to typed `setBase` in `reference/abilities.{en,ru}.json`. Default `"resolute"` is reset on every recalc (Bug #31 pattern).

### Problem

Spell entries currently carry `attackAttribute` per spell, locked to `resolute`
in most cases. `Leader` (an ability) needs to flip the magic attribute to
`appealing`. With the current model, every spell would have to be authored
twice (once per attribute) or the engine would need a special case.

### Resolution

Add a single derived character field `magicAttribute: PrimaryAttributeName`
(default `"resolute"`). Spells stop carrying their own `attackAttribute`;
they read the character's `magicAttribute` at resolution time. `Leader` becomes
a typed effect.

### Type changes

```ts
// src/rpg-types.mts

export interface Character {
  // ... existing fields ...
  /** Derived; default "resolute". UI-hidden. */
  magicAttribute: PrimaryAttributeName;
}

// Extend the EffectTarget union (ADR-015 amendment):
export type EffectTarget =
  | { kind: "secondary"; stat: SecondaryAttributeName }
  | { kind: "combat"; field: CombatSlotField }
  | { kind: "weaponQuality"; quality: string }
  | { kind: "armorQuality"; quality: string }
  | { kind: "flag"; name: EffectFlag }
  | { kind: "magicAttribute" };  // ← new
```

Modifier rules for `magicAttribute`:

- `setBase` only. Value MUST be a `PrimaryAttributeName`.
- `addFlat` / `multiply` / `cap` / `remove` are parser-rejected (mirrors §3b for `combat.attackAttribute`).

### Authoring example

```jsonc
// Leader (ability, Tier A)
{
  "tier": "A",
  "description": "Use Appealing instead of Resolute as your magic attribute.",
  "target": { "kind": "magicAttribute" },
  "modifier": { "type": "setBase", "value": "appealing" }
}
```

Strip the per-spell `attackAttribute` field from `reference/spells.{en,ru}.json`
in the same pass.

### Affected code & docs (schema ripple)

- `src/rpg-types.mts` — add field to `Character`, extend `EffectTarget`.
- `src/models/character.mts` — schema entry for `magicAttribute` with `ui.hidden: true`. Server-controlled; not in the validation surface for client writes.
- `src/rules/effects.mts` — `parseModifier` accepts `setBase` for new kind, rejects others.
- `src/rules/derived.mts` — new pipeline stage `deriveMagicAttribute(effects)`: pre-filter to `kind === "magicAttribute"`, resolve conflicts via the **highest-attribute-wins** policy (see [Item 5](#item-5--conflict-resolution-for-setbase-on-attribute-pointer-targets)). Default `"resolute"` if no effect.
- `src/rules/applicator.mts` — switch arm for the new kind in any phase that walks targets (likely a no-op outside the new derived stage).
- `docs/decisions/015-typed-effect-targets-final.md` — amend ADR-015 to document the 6-kind union and §3c (magicAttribute rules).
- `docs/data-contracts.md` — add `magicAttribute` to the Character shape table; mark derived; flag UI-hidden.
- `docs/authoring-effects.md` — `§7 Spells` and `§9 Effect targets table` updated.
- `reference/spells.{en,ru}.json` — strip per-spell `attackAttribute`.
- `reference/boons.{en,ru}.json` — author `Leader` as a typed effect.
- Tests: extend `test/rules/combat.test.mts` (or a new `test/rules/magic.test.mts`) to cover `magicAttribute` default + override + invalid-modifier rejection.

---

## Item 3 — Armor `appliesTo` is currently ignored

**Status:** ✅ Implemented (Chunk F post-pass — 2026-05-04). New optional `condition?: ArmorCondition[]` field on `ResolvedEffect` (ADR-015 §3f), accepted on `secondary` (character-level read) and `armorQuality` (per-piece read). Four kinds: `armorQuality | armorId | armorSlot | noArmor`. Combat Oils Novice now correctly fires only when an oiled piece is equipped; Soldier Adept's `hampering_N` removal is gated on the piece carrying that quality; Demiurge Hands Novice/Master are properly scoped to the plug. Bonus: `applyArmorQuality` now writes to `ArmorPiece.qualitiesEffective` (an engine overlay reset every recalc) instead of mutating authored `qualities`, closing the remaining caveat on weak-point Bug #31. Audit lint requires `condition` on every non-registry `armorQuality` effect. Tests in `test/rules/armor-condition.test.mts` + `test/rules/armor-overlay-leak.test.mts` (19 cases). Tracker entries: weak-point #32 (new) + #31 (caveat resolved).

### The question

> [`reference/abilities.en.json`](../../reference/abilities.en.json) lines 794–802 — Combat Oils Novice:
> ```jsonc
> {
>   "tier": "A",
>   "target": { "kind": "secondary", "stat": "armor" },
>   "modifier": { "type": "addFlat", "value": 4 },
>   "appliesTo": [{ "kind": "quality", "values": ["oiled"] }]
> }
> ```

> Will this effect apply to a specific armor currently equipped, or does the
> engine not understand this for armor?

### Answer (verified)

**The engine does not understand armor predicates.** Confirmed in code:

- `appliesTo` is typed as `WeaponPredicate[]` — the name is literal.
  See [`src/rpg-types.mts`](../../src/rpg-types.mts) `WeaponPredicate`.
- `applyArmorQuality` in [`src/rules/applicator.mts`](../../src/rules/applicator.mts) (lines 233–246) **never reads `effect.appliesTo`**. It walks `body` and `plug` and applies (or removes) the named quality on both unconditionally.
- The `secondary.armor` target in the Combat Oils effect doesn't even *try* to consult `appliesTo`; numeric secondary effects are accumulated globally regardless of predicates.

So the Combat Oils Novice effect as authored:

- The `addFlat: 4` to `secondary.armor` applies **always**, not just when wearing oiled armor.
- The `appliesTo` clause is silently ignored.

### Resolution (deferred)

Two parts, both deferred:

1. **Conditional application on the *character* level.** "Apply only if the equipped armor has quality X / no other armor / etc." is a real game requirement that doesn't fit the current `appliesTo` (slot-narrowing) model. Options:
   - Introduce an `ArmorPredicate` union (`{kind:"any"}|{kind:"quality"|"id"|"slot"; values:string[]}`) and let `appliesTo` be `WeaponPredicate[] | ArmorPredicate[]` with the engine picking the right matcher per effect target. Risk: `secondary.armor` is a *character-level* target, not slot-level — predicates would need a different name (`requires`?) to avoid conflating "narrow target" with "gate the whole effect."
   - Introduce a separate `requires` / `condition` field on `ResolvedEffect` whose vocabulary is intentionally small (only what authoring actually needs). Cleaner separation; new field rather than overloading `appliesTo`.
2. **Fix already-authored Combat Oils.** **Decided (user, 2026-05-05):** leave
   the `appliesTo` clause in place. It documents authorial intent, doesn't
   crash the engine (silently ignored at runtime), and gives the future engine
   work in (1) something concrete to flip on. Open a tracker entry in
   `.github/bugs/engine-weak-points.md` — "armor-side `appliesTo` and
   character-level effect gating ignored" — and close on implementation.

### Affected code (when implemented)

- `src/rpg-types.mts` — add `ArmorPredicate` or `EffectCondition` union.
- `src/rules/applicator.mts` — gate `applyArmorQuality` and any character-level numeric application on the new condition.
- `src/rules/effects.mts` — normalization of the new field.
- `docs/decisions/015-typed-effect-targets-final.md` — amend.
- `docs/authoring-effects.md` — document the new vocabulary and which target kinds it applies to.
- `.github/bugs/engine-weak-points.md` — open a tracker entry for "armor `appliesTo` ignored"; close on implementation.

---

## Item 4 — `initiativeAttribute` derived character field

**Status:** ✅ Implemented (G2.C — 2026-05-08). Mirrors Item 2: `initiativeAttribute: PrimaryAttributeName` field, `{ kind: "initiativeAttribute" }` target, `deriveInitiativeAttribute` stage, default `"quick"` reset on every recalc. *Tactics-novice* re-authored to typed `setBase` (Tier C → Tier A) in `reference/abilities.{en,ru}.json`. *Quick Reflexes Master* keeps its `flag: initiativeExemption` — unchanged, as flagged in the original problem statement.

### Problem

Initiative defaults to the `Quick` attribute. Some abilities change it:

- **Tactics Novice** (`reference/abilities.en.json` lines 961–973) — "Use Cunning instead of Quick to determine initiative." Authored today as a Tier C narrative-only effect (no `target`/`modifier`). Engine doesn't model it.
- **Quick Reflexes Master** (lines 484–497) — "always wins initiative." Authored today as `flag: initiativeExemption`. **This is *not* a numeric set-base** — it's an exemption flag. (The user's note about "setBasing it to 20" doesn't appear in the JSON; that's a separate concept that may or may not exist in the rules text.)

So the actual gap is: **swap the attribute used to compute initiative**, not "set
initiative to a number." The exemption flag pattern already covers the
"always wins" case correctly.

### Resolution

Mirror Item 2 — add a derived character field for the attribute, plus a new
`EffectTarget.kind`. Numeric initiative scores remain out of the engine for now
(no compelling case in the authored data; sibling apps can compute roll = attribute + d10 + flags themselves).

### Type changes

```ts
// src/rpg-types.mts

export interface Character {
  // ... existing fields ...
  /** Derived; default "quick". UI-hidden. */
  initiativeAttribute: PrimaryAttributeName;
}

export type EffectTarget =
  | { kind: "secondary"; stat: SecondaryAttributeName }
  | { kind: "combat"; field: CombatSlotField }
  | { kind: "weaponQuality"; quality: string }
  | { kind: "armorQuality"; quality: string }
  | { kind: "flag"; name: EffectFlag }
  | { kind: "magicAttribute" }       // Item 2
  | { kind: "initiativeAttribute" }; // ← new
```

Modifier rules for `initiativeAttribute`:

- `setBase` only. Value MUST be a `PrimaryAttributeName`. Same parser/policy as `magicAttribute`.

### Authoring example

```jsonc
// Tactics Novice — replace the current narrative-only Tier C with a typed Tier A
{
  "tier": "A",
  "description": "Use Cunning instead of Quick to determine initiative.",
  "target": { "kind": "initiativeAttribute" },
  "modifier": { "type": "setBase", "value": "cunning" }
}
```

Quick Reflexes Master stays as-is — `flag: initiativeExemption` correctly
models "exempt from the normal initiative comparison."

### Conflict resolution

Same policy as `magicAttribute` and per-slot `combat.attackAttribute`:
**highest-attribute-wins** — see [Item 5](#item-5--conflict-resolution-for-setbase-on-attribute-pointer-targets).

### Affected code & docs

Same shape as Item 2:

- `src/rpg-types.mts` — field + EffectTarget extension.
- `src/models/character.mts` — schema entry, `ui.hidden: true`, server-controlled.
- `src/rules/effects.mts` — modifier validation.
- `src/rules/derived.mts` — `deriveInitiativeAttribute` stage (sibling to `deriveMagicAttribute`).
- `src/rules/applicator.mts` — switch arm for new kind.
- `docs/decisions/015-typed-effect-targets-final.md` — same amendment as Item 2 (one revision, both kinds).
- `docs/data-contracts.md` — add `initiativeAttribute`.
- `docs/authoring-effects.md` — §9 effect targets table.
- `reference/abilities.{en,ru}.json` — re-author Tactics Novice; audit other initiative-related abilities surfaced during the bulk pass.
- Tests: cover default, override, conflict policy, invalid modifier rejection.

---

## Item 5 — Universal conflict resolution for `setBase`

**Status:** ✅ Implemented (G2.A — 2026-05-08). Extracted as `resolveSetBase(defaultName, candidates, primary)` in [src/rules/setbase.mts](../../src/rules/setbase.mts). Default-inclusive max-by-primary, strict `>` comparison so the field default wins ties. `applySetBase` is now a candidate-collector — resolution runs after the primary phase against the post-effect snapshot (`primaryEffective`) and is reused per-slot in `deriveCombatSlots` for `combat.attackAttribute`, plus once each in `deriveMagicAttribute` / `deriveInitiativeAttribute`. ADR-015 §4a documents the rule. **Behavioural note:** three secondary-defense `setBase` authors (*Smoke and Mirrors-novice*, *Tactics-adept*, *Sixth Sense-adept*) now coexist correctly on the same character vs the pre-G2 "last wins" semantics.

### Why this is universal

Look at `EffectModifier` in [src/rpg-types.mts](../../src/rpg-types.mts):

```ts
export type EffectModifier =
  | { type: "setBase"; value: PrimaryAttributeName }
  | { type: "addFlat"; value: number }
  | ...
```

The `setBase` `value` is **always** a `PrimaryAttributeName` by type. Every
`setBase`-able target is therefore an *attribute-pointer*: a field whose
effective value is `character.attributes.primary[name]` for some attribute
name. That includes everything `setBase` already accepts today
(`secondary.defense`, `combat.attackAttribute`) and everything the amendment
adds (`magicAttribute`, `initiativeAttribute`).

The policy below is therefore not target-specific — it is **the** semantics of
`setBase` across the whole engine.

### Problem

Multiple effects can `setBase` the same scope. Authored cases already exist:

- **Knife Mastery Novice** ([abilities.en.json:350-364](../../reference/abilities.en.json#L350-L364)) —
  `combat.attackAttribute := quick`, `appliesTo: [{ kind: "quality", values: ["short"] }]`.
- **Iron Body Novice** ([abilities.en.json:2913-2939](../../reference/abilities.en.json#L2913-L2939)) —
  `combat.attackAttribute := strong`, `appliesTo: [{ kind: "type", values: ["heavy", "polearm", "main", "shield", "light", "natural"] }]`.

A character with both abilities, carrying a *light short knife*, matches both
predicates on the same slot — engine has two competing `setBase`s on
`combat.attackAttribute`. Same-shape conflicts will arise on `magicAttribute`
(Item 2) and `initiativeAttribute` (Item 4) once their authoring expands, and
on `secondary.defense` if a future ability competes with Tactics Adept.

### Policy: highest-attribute-wins

When `n ≥ 2` `setBase` modifiers target the same field on the same scope
(character-level for character fields; per-slot for `combat.*`), the engine
picks the candidate whose value maximizes
`character.attributes.primary[value]`.

This matches game intent (the player benefits from whichever swap is best
for them) and is composable: adding a new ability never makes the character
worse at the affected check.

### Algorithm

```ts
// Single helper used by every derived stage that resolves setBase.
function resolveSetBase(
  defaultName: PrimaryAttributeName,
  candidates: PrimaryAttributeName[],
  primary: PrimaryAttributes,
): PrimaryAttributeName {
  // Default is always a candidate so a useless setBase never makes things worse.
  const all = [defaultName, ...candidates];
  // Stable max: highest score wins; on ties, earlier candidate wins
  // (default first, then declaration order). Deterministic, no tier needed.
  return all.reduce((best, cur) =>
    primary[cur] > primary[best] ? cur : best
  );
}
```

Properties:

- **Default-inclusive** — the natural attribute is in the candidate set, so a
  setBase to a *worse* attribute is silently ignored. (No "the ability made
  me worse" footguns.)
- **Stable** — strict `>` keeps the first-seen candidate on ties, so order
  matters only when scores are equal (and then it's deterministic).
- **Tier-agnostic** — no tier hierarchy involved. Tier remains a
  cost/availability concept, not a precedence one.
- **Reactive** — recomputed every recalc, so changing the underlying primary
  attribute (or the equipped weapon, for combat) automatically re-picks.

### Where it applies

Every target that accepts `setBase`. Today and after this amendment:

| Target | Scope | Default | Candidates |
| --- | --- | --- | --- |
| `secondary.defense` | character | `"quick"` | every effect with `target.kind === "secondary"`, `stat === "defense"`, modifier `setBase` |
| `magicAttribute` (Item 2) | character | `"resolute"` | every effect with `target.kind === "magicAttribute"` and modifier `setBase` |
| `initiativeAttribute` (Item 4) | character | `"quick"` | every effect with `target.kind === "initiativeAttribute"` and modifier `setBase` |
| `combat.attackAttribute` | per-slot | weapon's intrinsic `attackAttribute` | every effect with `target.kind === "combat"`, `field === "attackAttribute"`, modifier `setBase`, **whose `appliesTo` matches the slot's weapon** |

If a future target ever accepts `setBase`, it inherits this policy by virtue
of using the helper — no per-target ruling needed.

For `combat.attackAttribute`, the per-slot evaluation must happen *after*
`appliesTo` filtering (already done by `deriveCombatSlots`). The reduce is
over the surviving candidates only.

### Required engine changes

1. **`combat.attackAttribute`** — currently `applySlotPhases` in [src/rules/derived.mts](../../src/rules/derived.mts)
   applies `setBase` directly per-effect (last-wins by iteration order). Refactor:
   collect candidates first, reduce via `resolveSetBase(weapon.attackAttribute, candidates, primary)`, apply once.
2. **`secondary.defense`** — same refactor in the secondary-attribute pipeline. Today only Tactics Adept writes this, so the change is observationally a no-op until a second author lands; do it anyway for consistency.
3. **`magicAttribute` / `initiativeAttribute`** — new derived stages (Items 2 and 4) call the helper directly; nothing to refactor.

`addFlat` / `multiply` / `cap` are unaffected — they keep their current
accumulation semantics. The policy only governs `setBase`.

### Affected code & docs

- `src/rules/derived.mts` — extract `resolveSetBase` helper at module top; use in
  every derived stage that processes `setBase` (defense, attackAttribute,
  magicAttribute, initiativeAttribute).
- `src/rules/effects.mts` — no parser changes; the existing
  `EffectModifier.setBase.value: PrimaryAttributeName` type already enforces shape.
- `docs/decisions/015-typed-effect-targets-final.md` — add a top-level
  semantics paragraph: "`setBase` resolution is highest-attribute-wins; the
  default value is always in the candidate set." Update §3a/§3b prose to
  reference the unified rule.
- `docs/authoring-effects.md` — add a one-paragraph note: conflicting
  `setBase` effects need no manual reconciliation; the engine picks the best.
- Tests: dedicated `test/rules/setbase-resolution.test.mts`
  covering: single setBase, two setBases (better wins), two setBases
  (worse ignored, default wins), tie (stable order), per-slot scoping for
  combat.attackAttribute (Knife Mastery + Iron Body on a light short knife),
  defense scoping at character level, reactivity to primary stat changes.

### Authoring impact

None. Authors keep writing `setBase` as before; the resolution is invisible
from the data side. Removes the need for any "specificity" or "priority"
field on effects, which keeps ADR-015 lean.

---

## Item 6 — Status infliction tracking on `Action` / `SpecialAttack` / `Reaction`

### Problem

Real abilities and spells inflict statuses on their targets:

- **Cheap Shot** (Street Fighting Novice) — stuns on hit.
- **Backstab** (Intrigues Adept) — inflicts persistent bleeding.
- **Strangling** — chokes / suffocates.
- Various spells — burn, freeze, frighten, etc.

The engine doesn't model status durations or stacking (sibling apps own that,
same as `EffectFlag`), but it should **declare** what an action inflicts so
sibling apps (Discord bot, WoW addon) can render "this attack applies stun"
in tooltips and combat logs.

Today `SpecialAttack` / `Reaction` (`Action` base) carry no status field.
Authors are forced to bake status info into free-text `description`, which
sibling apps can't reliably parse.

### Resolution

Mirror the `EffectFlag` enum pattern. Add a `StatusKind` string-literal union
and an optional `inflicts?: StatusKind[]` field on `Action`.

```ts
// src/rpg-types.mts

// Statuses an attack/reaction can apply to its TARGET. Sibling apps own
// duration, stacking, and resolution. The engine only carries the labels
// through to consumers. Same lifecycle policy as EffectFlag.
export type StatusKind =
  | "stun"
  | "bleed"
  | "prone"
  | "choke"
  | "poisoned"
  | "burning"
  | "frozen"
  | "blinded"
  | "silenced"
  | "entangled"
  | "frightened"
  | "disarmed";
// NOTE: starting set; expand during the authoring pass.

export interface Action {
  source: string;
  name: string;
  trigger: TriggerKind;
  attackAttribute?: PrimaryAttributeName;
  damage?: number;
  damageBonus?: number;          // Item 1
  ignoresArmor?: boolean;        // Item 1
  weaponFilter?: WeaponPredicate[]; // Item 1
  effects?: ResolvedEffect[];
  /** Statuses applied to the TARGET on a successful hit. Engine
   *  does not model lifecycle; sibling apps consume verbatim. */
  inflicts?: StatusKind[];
}
```

### Authoring examples

```jsonc
// Cheap Shot — stuns on hit
{
  "name": "Cheap Shot",
  "trigger": "manual",
  "damage": 6,
  "attackAttribute": "quick",
  "inflicts": ["stun"]
}

// Backstab Adept — bleed rider on top of base damage
{
  "name": "Backstab",
  "trigger": "manual",
  "damageBonus": 4,
  "inflicts": ["bleed"]
}

// Knock Over (Street Fighting Adept reaction)
{
  "name": "Knock Over",
  "trigger": "onHit",
  "inflicts": ["prone"]
}
```

### Why a separate enum from `EffectFlag`

- **Different subject.** `EffectFlag` is a property of the *character* ("I have darkvision"). `StatusKind` is a property of an *attack's target* ("this attack stuns the enemy").
- **Different lifecycle owner.** Flags live on `character.flags[]`, computed by recalc and replaced wholesale each pass. Statuses are per-encounter target state, owned entirely by sibling combat resolvers.
- **Different vocabulary.** Flags are typed traits; statuses are mostly debuffs. Mixing them would let authors write nonsense like `flag: "bleed"` or `inflicts: ["darkvision"]`.

### Out of scope

- **Status parameters** (duration, severity, save DC). The bulk pass declares
  *what* gets inflicted; *how strong / for how long* is sibling-app territory.
  Defer until a sibling project surfaces a concrete need.
- **Self-statuses** ("the user becomes enraged"). Different shape; revisit if
  authoring data demands it. For now, model self-state as `EffectFlag`.

### Affected code & docs

- `src/rpg-types.mts` — add `StatusKind` union; add `inflicts?: StatusKind[]` to `Action`.
- `src/models/character.mts` — no schema change (specialAttacks/reactions are derived, server-controlled).
- `src/rules/effects.mts` — if/when actions are normalized through the effects pipeline, validate `inflicts[]` entries are known `StatusKind`s.
- `docs/decisions/014-per-slot-combat-special-attacks.md` — amend to document the `inflicts` field and the no-lifecycle policy.
- `docs/authoring-effects.md` — add a `§Status infliction` section listing the enum and the rule "declare what gets applied; engine doesn't model duration."
- `docs/data-contracts.md` — add `inflicts` to the SpecialAttack/Reaction shape; sibling-project contracts get a heads-up.
- `reference/abilities.{en,ru}.json` and `reference/spells.{en,ru}.json` — walk every authored special attack / reaction; add `inflicts[]` where the description implies it. Audit by Ctrl-F on "stun", "bleed", "prone", "choke", "burn", etc.
- Tests: round-trip `inflicts` through serialization; verify unknown statuses fail validation.

---

## Item 7 — Boons / Sins authoring policy: opportunistic engine effects

### Background

ADR-014 / Chunk F initially declared boons and sins **non-combat** — they
stay flat (no per-rank `effects[]`) and the engine doesn't consume them.
That framing was correct in the bulk: most boons and sins are personality /
social / narrative.

Mid-authoring discovery: **some boons set up flags that *do* have combat use**
(e.g. `fireResistance`, `darkvision`, `trueSight`, `evasion`). A few sins
likewise impose combat-relevant downsides (e.g. corruption thresholds,
attribute caps in specific situations). Treating them as opaque narrative
leaves the engine and sibling apps blind to mechanics that genuinely matter.

### Decision

**Opportunistic, not exhaustive.** Author engine effects on a boon or sin
*only when* it produces a typed observable consequence:

- A `flag` that is consumed somewhere by combat or another typed effect.
- A `secondary` modifier (defense, armor, painThreshold, etc.).
- A `setBase` on a derived attribute (magicAttribute, initiativeAttribute, defense, attackAttribute).
- A `weaponQuality` / `armorQuality` toggle that affects an equipped item.

Do **not** fabricate effects for boons/sins whose impact is purely narrative
("loved by everyone," "prone to brooding"). Leaving `effects` absent or `[]`
is correct — not a gap.

### Authoring rule of thumb

For each boon/sin, ask:

> If I removed this boon/sin from the character, would *any other typed
> effect or per-slot calculation* produce a different number?

- **Yes** → author the effect(s) that drive the difference. Mark `tier: "B"` if it's mostly out-of-combat with combat side-effects, `"A"` if it's structurally combat-shaping. Tier C remains the narrative-only fallback.
- **No** → leave it flat.

### Examples

**Author engine effects:**

```jsonc
// Boon: "Fire-touched" (or whatever the in-fiction name is)
{
  "id": "fire-touched",
  "name": "Fire-touched",
  "description": "Long exposure to flame has hardened your skin against it.",
  "effects": [
    {
      "tier": "B",
      "description": "Resistant to fire damage.",
      "target": { "kind": "flag", "name": "fireResistance" },
      "modifier": { "type": "addFlat", "value": 1 }
    }
  ]
}
```

**Leave flat:**

```jsonc
// Boon: "Beloved Storyteller" — narrative only
{
  "id": "beloved-storyteller",
  "name": "Beloved Storyteller",
  "description": "Strangers warm to you quickly when you spin a tale."
  // no effects[]
}
```

### Schema impact

Minimal. The boon/sin shape already permits an optional `effects[]` (it just
wasn't being used). Authoring rule lives in `docs/authoring-effects.md`; no
type changes needed.

### Affected code & docs

- `docs/authoring-effects.md` — amend §3 (Boons) and §4 (Sins) to document the
  opportunistic-effect policy with the rule of thumb and examples above.
- `reference/boons.{en,ru}.json` and `reference/sins.{en,ru}.json` — during
  the bulk pass, walk each entry and apply the rule of thumb. Most stay flat;
  a small subset gain `effects[]`.
- `src/rules/effects.mts` — already collects from talents (boons/sins) via
  `collectAllEffects` if `effects[]` is present; no change needed. Verify
  with a test that a boon-driven flag round-trips through recalc.
- Reference catalog loader — no change; the `effects` field is optional.
- `EffectFlag` enum extension: as boon authoring surfaces flags not yet in
  the union (e.g. `fireResistance` already there; new ones likely), extend
  it in the same pass. Same policy as Chunk F's general flag cleanup.

### Out of scope

- **Conditional effects** ("only at night," "only when wounded"). These need
  the same conditional-application machinery as Item 3 (armor `appliesTo`).
  Defer; if a boon needs it, leave it as a `tier: "C"` narrative description
  for now.
- **Stacking with rank.** Boons/sins are flat (no ranks per Chunk F lock-in).
  If the rules text introduces tiered boons later, revisit.

---

## Item 8 — Free-attack tracking on `SpecialAttack`

### Problem

Several weapon-related abilities grant **free attacks** — extra strikes that
don't consume the character's normal action (Two Weapons, Stab, Quick Reload,
etc.). Sibling apps (combat tracker in the bot, hot-bar in the addon) need to
know how many free attacks a character has available per turn, and which
weapon slot each one belongs to.

Today special attacks land in `character.specialAttacks: SpecialAttack[]` as a
flat list with no "free" flag. Siblings can't distinguish "extra knife strike
that costs no action" from "Cheap Shot, costs your action."

### Decision

Add `isFree?: boolean` to `Action` (so it inherits onto `SpecialAttack` and,
should the need ever arise, `Reaction`). Engine **declares**, doesn't count.

```ts
// src/rpg-types.mts
export interface Action {
  source: string;
  name: string;
  trigger: TriggerKind;
  // ...other Item 1 / Item 6 fields...
  /** True if this attack does not consume the character's normal
   *  action / turn slot. Sibling apps may total/group as needed. */
  isFree?: boolean;
}
```

### Why declare-only (no per-slot count)

- Per-slot attribution isn't always intrinsic. Stab inherits the carried knife
  via Item 1's `weaponFilter` — its "slot" depends on which slot is currently
  carrying a knife. Counting would need re-evaluation on every equipment
  change *and* duplicate the per-slot match logic that's already on the action.
- Siblings already iterate `character.specialAttacks[]` to render UI; filtering
  `attacks.filter(a => a.isFree)` and bucketing by `weaponFilter` match is one
  line on their side.
- Keeping the engine declarative-only also matches the established policy for
  `EffectFlag` and Item 6's `StatusKind`: the engine carries labels through;
  consumers interpret them.

If Phase 7 integration surfaces a real need for engine-computed counts, revisit
and add a derived `combat.freeAttacks: number` per-slot field. Don't pre-build it.

### Authoring examples

```jsonc
// Two Weapons Adept — free off-hand strike with the carried off-hand weapon
{
  "name": "Two Weapons: Off-hand Strike",
  "trigger": "manual",
  "isFree": true,
  "weaponFilter": [{ "kind": "any" }] // resolves to off-hand by sibling logic
}

// Stab (Knife Mastery Adept) — free knife attack, inherits from carried knife
{
  "name": "Stab",
  "trigger": "manual",
  "isFree": true,
  "weaponFilter": [{ "kind": "type", "values": ["knife"] }]
}

// Cheap Shot — NOT free
{
  "name": "Cheap Shot",
  "trigger": "manual",
  "damage": 6,
  "attackAttribute": "quick",
  "inflicts": ["stun"]
  // no isFree
}
```

### Affected code & docs

- `src/rpg-types.mts` — add `isFree?: boolean` to `Action`.
- `docs/decisions/014-per-slot-combat-special-attacks.md` — document the field
  and the no-engine-count rule.
- `docs/authoring-effects.md` — note in the special-attacks section: mark
  `isFree: true` for ability-granted free attacks; omit otherwise.
- `reference/abilities.{en,ru}.json` — audit during the bulk pass; add
  `isFree: true` to free-attack entries (Two Weapons, Knife Mastery Stab,
  Quick Reload, etc.).
- No engine work beyond carrying the field through serialization.

---

## Item 9 — Special-attack rewrite by id (rank supersedes lower rank)

### Problem

Some abilities upgrade their special attacks at higher ranks rather than
adding new ones. Compare:

- **Shield Bash** (`abilities.en.json` lines 3112-3120 adept, 3130-3138 master)
  — same name "Shield Bash"; master should *replace* adept (more damage).
- **Sulfur Cascade** (`spells.en.json` lines 1766-1774 novice "Scorch", 1784-1792 adept "Pyroclasm")
  — different names; both should *coexist* (different mechanics).

Today `recalculate()` concatenates all granted tiers' `specialAttacks[]`
arrays end-to-end, so Shield Bash appears twice (adept + master both fire) and
the character ends up with two entries differing only in damage. UI is
ambiguous; the wrong one might be selected.

The author's convention is already in place (same name = rewrite, different
name = coexist), but the engine ignores it.

### Decision

Engine dedupes during the special-attacks / reactions collection step:
**group by `id`, highest rank wins.** `id` is **required** on every
`Action` (covers both `SpecialAttack` and `Reaction` since they share the
base). Names are localized and **never** used for comparison.

```ts
export interface Action {
  /** REQUIRED stable identifier. Locale-independent. Used for
   *  rewrite-group dedupe: when two actions share the same id, the one
   *  granted at the higher ability rank replaces the lower. */
  id: string;
  source: string;
  name: string;
  // ...rest unchanged...
}
```

No backward compatibility. Pre-Chunk-F authoring is being walked
end-to-end during this pass anyway, so the cost of "add an `id` to every
special attack and reaction" is the same whether we phase it or rip the
band-aid off. Strict from day one is cheaper than living with a fallback.

### Algorithm

```ts
type Granted<T> = { action: T; rank: number };

function dedupeByRewrite<T extends Action>(granted: Granted<T>[]): T[] {
  const best = new Map<string, Granted<T>>();
  for (const g of granted) {
    const prev = best.get(g.action.id);
    if (!prev || g.rank > prev.rank) best.set(g.action.id, g);
  }
  return [...best.values()].map(g => g.action);
}
```

**Rank is intrinsic to the collection step.** When recalc walks the
character's granted ability/spell tiers it already knows the tier (`novice` =
1, `adept` = 2, `master` = 3); stamping `rank` on each granted action while
collecting is essentially free. Same shape works for spells (spell tiers map
to the same 1/2/3 ladder).

For actions granted by *different* abilities that happen to collide on
key — that's an authoring error; document it in the lint pass (Item 9b
below) but don't try to be clever in the engine.

### Authoring convention

- Use the **same `id`** across ranks of the same ability when later ranks
  *rewrite* the lower one. Example: Shield Bash novice/adept/master all carry
  `"id": "shield-bash"`.
- Use **different `id`s** (and different `name`s) when later ranks *add* a
  new attack. Example: `"sulfur-cascade-scorch"` (novice), `"sulfur-cascade-pyroclasm"` (adept).
- `id` is **always required**. Validation rejects entries without it.
- Convention: prefix with the parent ability/spell id (`shield-bash`, not `bash`).
- Localized files (`*.en.json`, `*.ru.json`) **must** carry the same `id` for
  the same logical action. The locale-drift lint
  (`test/reference-locale-drift.test.mts`) already enforces structural
  parallelism; extend it to compare `id`s on every special-attack / reaction
  position.

### Lint additions (Item 9b)

To make authoring errors loud, add three lint checks:

1. **Missing `id`.** Every special attack / reaction in `reference/abilities.*.json`
   and `reference/spells.*.json` must have a non-empty `id`. Reject otherwise.
2. **Duplicate `id` within one entry's tier.** If a single tier produces two
   special attacks with the same `id`, fail (probably a copy-paste).
3. **Same `id` across unrelated parent entries.** If two *different* abilities
   or spells produce a special attack/reaction with the same `id`, fail — ids
   should be parent-scoped via the prefix convention.
4. **Locale-drift parity.** `*.en.json` and `*.ru.json` must carry identical
   `id`s at every parallel special-attack / reaction position.

### Affected code & docs

- `src/rpg-types.mts` — add **required** `id: string` to `Action`.
- `src/rules/derived.mts` — at the special-attacks / reactions collection step
  (currently a flat concat in `recalculate`), wrap with `dedupeByRewrite`.
  Stamp `rank` per granted tier during collection.
- `docs/decisions/014-per-slot-combat-special-attacks.md` — document the
  rewrite-by-id rule and rank semantics.
- `docs/authoring-effects.md` — explain the same-id-rewrites convention with
  Shield Bash and Sulfur Cascade as the worked examples.
- `reference/abilities.{en,ru}.json`, `reference/spells.{en,ru}.json` — bulk
  pass adds `id` to every special-attack / reaction entry.
- `test/reference-locale-drift.test.mts` — extend to require matching `id`s
  on parallel special-attack / reaction positions.
- New `test/rules/special-attacks-rewrite.test.mts` — covers: same-id higher
  rank wins, different-id coexist, missing-id rejection.

### Why this is cheap

The rewrite is a single `Map`-based pass during a step that already exists
(special-attacks / reactions concatenation). No new pipeline phase, no schema
churn beyond one optional field, no per-slot or effect-engine changes. The
"one map per collection" cost is negligible compared to the existing
`collectAllEffects` walk.

### Out of scope

- **Rewrite across abilities.** If Ability X grants `id: "bash"` and Ability Y
  grants `id: "bash"`, the lint flags it; the engine will pick whichever has
  the higher ability rank, but that's incidental, not a feature.
- **Partial-field rewrite** ("master Shield Bash inherits adept's `inflicts`
  but overrides damage"). Not needed today; everything that rewrites rewrites
  the whole record. If a real case appears, model it as an effect on the
  lower-rank action rather than partial-merge logic.

---

## Item 10 — `EffectTarget.kind = "primary"` for primary-attribute boosters

### Problem

Mid-authoring discovery: several abilities raise a primary attribute *past
its normal cap*. Examples:

- **Quick** (training ability) — novice +1 Quick, adept +2 Quick total, master +3.
- Equivalent abilities for other primaries are likely.

Authoring already in place (`reference/abilities.en.json` lines 1262-1275)
writes `"target": { "kind": "primary", "stat": "quick" }`. **The current
`EffectTarget` union has no `"primary"` kind** — see
[`src/rpg-types.mts`](../../src/rpg-types.mts) line 111. The parser
(`parseModifier` / target validator) will reject these effects today.

### Decision

Add a 6th kind (or 7th, after `magicAttribute`) to `EffectTarget`:

```ts
export type EffectTarget =
  | { kind: "primary"; stat: PrimaryAttributeName }   // ← new
  | { kind: "secondary"; stat: SecondaryAttributeName }
  | { kind: "combat"; field: CombatSlotField }
  | { kind: "weaponQuality"; quality: string }
  | { kind: "armorQuality"; quality: string }
  | { kind: "flag"; name: EffectFlag }
  | { kind: "magicAttribute" }      // Item 2
  | { kind: "initiativeAttribute" } // Item 4
  ;
```

Modifier rules for `kind: "primary"`:

- `addFlat`: ADD `value` to the primary attribute. Standard accumulation.
- `cap`: clamp the primary attribute. Useful for sin-imposed soft caps.
- `setBase`: **rejected.** Primary attributes are character-authored ground
  truth; no ability "sets" a primary attribute to a value, only modifies it.
- `multiply`: **rejected.** Doubling a primary attribute is not a real game
  mechanic; if it ever becomes one, revisit.
- `remove`: **rejected** (only meaningful for set-membership targets).

### Pipeline placement

Primary-attribute effects must resolve **before** any derived stage that
reads `character.attributes.primary[name]`. That includes:

- Item 5's `resolveSetBase` (compares `primary[best]` vs `primary[cur]`).
- Secondary attribute derivation (toughness, defense, painThreshold, etc.).
- Per-slot combat (attackAttribute resolution, baseDamage formulas).

New earliest pipeline stage: `derivePrimaryAttributes(effects)` runs *first*,
produces an effective `primary` snapshot used by every downstream stage.
Replaces direct reads of `character.attributes.primary` in the engine.

### Authoring example

```jsonc
// Quick (ability), Novice tier
{
  "tier": "A",
  "description": "Raises Quick by one point.",
  "target": { "kind": "primary", "stat": "quick" },
  "modifier": { "type": "addFlat", "value": 1 }
}
```

### Affected code & docs

- `src/rpg-types.mts` — extend `EffectTarget` with `"primary"` kind.
- `src/rules/effects.mts` — `parseModifier` accepts `addFlat`/`cap` for the
  new kind, rejects `setBase`/`multiply`/`remove`.
- `src/rules/derived.mts` — add `derivePrimaryAttributes` as the first
  pipeline stage; route every downstream stage through the result rather
  than reading `character.attributes.primary` directly.
- `src/rules/applicator.mts` — switch arm for the new kind.
- `docs/decisions/015-typed-effect-targets-final.md` — add §3e for
  `"primary"`.
- `docs/authoring-effects.md` — add §8 entry for `kind: "primary"`.
- `reference/abilities.{en,ru}.json` — the already-authored Quick entries
  start working as-is once the kind is added.
- Tests: cover Quick novice/adept/master stacking, interaction with cap
  effects, propagation into Item 5 setBase resolution.

### Status

✅ Implemented 2026-05-06 (G1.A). Six-kind `EffectTarget` union; parser
accepts `addFlat`/`cap`, rejects `setBase`/`multiply`/`remove` with warn;
strips `appliesTo` with warn. New `derivePrimaryAttributes` pre-pipeline
stage runs ahead of `setBase`. Applicator gained no-op exhaustiveness arms.
15-test suite (`test/rules/primary-attributes.test.mts`) covers stacking,
cap precedence, propagation into secondary toughness, parser rejection.
ADR-015 §3e and authoring-effects §8 published; audit script's
`KNOWN_TARGET_KINDS` extended.

#### Follow-up fix — `attributes.primaryEffective` sibling field (2026-05-07)

The original implementation wrote the post-effect snapshot back into
`character.attributes.primary`. Storage then persisted those values, which
(a) violated the schema's `min: 5, max: 15` validation on next load,
(b) accumulated drift on every recalc (`15 → 18 → 21 → …`), and
(c) made the natural UI display "base + bonus = effective" impossible.

Resolution (Option A, no schema-version bump):

- `CharacterAttributes` gains sibling field `primaryEffective: PrimaryAttributes`.
- Schema marks it `derived: true` + `serverControlled: true`, permissions
  `perm_attr`, `displayAs: "readonly"`, no `min`/`max`. Auto-stripped from
  POST/PATCH bodies via existing `filterServerControlledFields`. Auto-skipped
  by `generateDefaultCharacter`.
- `derivePrimaryAttributes` resets `result.attributes.primaryEffective =
  { ...result.attributes.primary }` on every recalc (Bug #31 reset pattern),
  then applies `addFlat`/`cap` onto the snapshot. `attributes.primary`
  remains the player-authored 5–15 base and is never mutated by the engine.
- `readPrimary` reads `primaryEffective` with fallback to `primary` for
  partial fixtures.
- Tests: 8 existing pipeline assertions rewritten to `primaryEffective`
  with explicit base-preservation checks; new idempotency-across-recalcs
  test; new JSON serialize/deserialize round-trip test; mutation test
  checks both fields. Stripping test in `test/utils.test.mts`,
  generation-exclusion test in `test/validation.test.mts`. `+3 tests`
  (561 → 564). Pre-existing on-disk characters wiped via `hard-delete --all`.
- Docs: `docs/data-contracts.md` JSONC mockup gains `primaryEffective`
  block; ADR-015 §3e amended with the writes-to-primaryEffective rule
  and the `serverControlled` callout; `docs/authoring-effects.md` §8
  `primary` entry gains a "Display semantics" callout.

---

## Item 11 — `secondary.toughness` writeable as a single value

### Problem

Authoring has been writing `"stat": "toughness.max"` (e.g. Feat of Strength
Novice, `reference/abilities.en.json` lines 3431-3444). This is invalid:

```ts
export type SecondaryAttributeName = keyof SecondaryAttributes;
// = "toughness" | "defense" | "armor" | "painThreshold"
//   | "corruptionThreshold" | "corruptionMax"
```

`toughness` is the key; the value at that key is `Toughness = { max, current }`.
There is no nested-path support in `EffectTarget`.

### Decision

**Convention:** all numeric modifiers on `"stat": "toughness"` operate on
`toughness.max`. `toughness.current` is **runtime state** (combat damage,
healing) that the rules engine never writes — only consumers (combat tracker,
wound system) update it. The engine's responsibility ends at `max`.

Authoring fix: rewrite `"toughness.max"` → `"toughness"` everywhere. Engine
behaviour: `addFlat`/`multiply`/`cap` on `toughness` write to `.max`.

### Why not allow nested paths

Adding nested-path support (`"toughness.max"`, `"toughness.current"`) opens
a can of worms:

- Schema validation needs to know which paths are writable per stat.
- `current` is per-character runtime state, not derivable; the engine has no
  business writing it during recalc.
- No real authoring need for `current`-modifying effects ("heal +d6") inside
  the static reference catalogs — those are runtime actions.

One writable target per `SecondaryAttributeName`. Done.

### Affected code & docs

- `src/rules/applicator.mts` — when applying modifiers to
  `secondary.toughness`, write to `.max`.
- `src/rules/derived.mts` — the secondary-derivation stage that initializes
  `toughness.max` from primary attributes and effects already operates this
  way; verify and document.
- `docs/authoring-effects.md` — add a note in §8 `secondary` entry: "For
  `toughness`, modifiers operate on `.max`; `.current` is runtime state."
- `reference/abilities.{en,ru}.json` — search-and-replace `"toughness.max"`
  → `"toughness"`.
- Test: `addFlat` on `secondary.toughness` writes to `.max`, leaves `.current`
  alone.

### Status

✅ Implemented 2026-05-06 (G1.B). Engine already wrote to `.max` across
`addFlat`/`multiply`/`cap`/formula phases; G1.B added 3 explicit
regression tests (`addFlat` / `multiply` / `cap` on `secondary.toughness`
writes to `.max`, leaves `.current` untouched) in
`test/rules/applicator.test.mts`. Reference sweep confirmed clean
(`grep "toughness.max" reference/` → 0 matches). Authoring spec §8
`secondary` entry now carries the writes-to-`.max` note.

---

## Item 12 — Cosmetic conventions: explicit `appliesTo` and `stat`/`field` naming

Two bikeshed-tier proposals raised mid-authoring. Both are pure cosmetics —
no engine semantics change. Decisions captured here so the bulk re-authoring
pass touches them once.

### 12a. Explicit "applies to everything" form

**Today:** `appliesTo` omitted (or `[]`) means "every slot." Documented in
[`docs/authoring-effects.md`](../../docs/authoring-effects.md) §9.

**Proposal:** prefer the explicit canonical form `[{ "kind": "any" }]`
wherever `appliesTo` would be meaningful but the author wants "all weapons."

**Why not `['*']`:** it would require either a string-or-object union in
`WeaponPredicate` (parser branch + type widening + lint sugar), or a
schema-only sigil that the parser rewrites. Neither is free; both add a
special case for one cosmetic gain.

**`[{ "kind": "any" }]` is already valid, type-correct, parser-supported, and
self-documenting** — no changes needed beyond authoring convention.

**Decision:**

- For `kind: "combat"` and `kind: "weaponQuality"` effects (where `appliesTo`
  is meaningful), authoring **must** include `appliesTo`. Use
  `[{ "kind": "any" }]` when the effect should fire on every slot.
- For all other targets (`secondary`, `armorQuality`, `flag`, `primary`,
  `magicAttribute`, `initiativeAttribute`), `appliesTo` is meaningless and
  **must be omitted**.
- Lint extension: validate that `appliesTo` is present (and non-empty) on
  combat/weaponQuality targets, and absent everywhere else.

No type changes. Documentation update + authoring sweep + one lint rule.

### 12b. Discriminator field naming — `stat` vs `field`

**Today:** the per-kind discriminator field name varies:

| `kind`                | property | type |
| --------------------- | -------- | --- |
| `secondary`           | `stat`   | `SecondaryAttributeName` |
| `combat`              | `field`  | `CombatSlotField` |
| `weaponQuality`       | `quality`| `string` |
| `armorQuality`        | `quality`| `string` |
| `flag`                | `name`   | `EffectFlag` |
| `primary` (Item 10)   | `stat`   | `PrimaryAttributeName` |

The discriminator is `kind`; the second property is just "which one within
the kind." Names are independent and don't aid disambiguation.

**Two reasonable options:**

1. **Leave as-is.** Each name carries a hint: `stat` = "a numeric character
   stat"; `field` = "a structural slot on a per-slot record"; `quality` =
   "id from a registry"; `name` = "flag-set membership." Self-documenting.
2. **Unify on `field`.** One name everywhere, easier to remember; loses the
   per-kind hint.

**Recommendation:** leave as-is. The hint genuinely helps when scanning
authored JSON — reading `"stat": "toughness"` vs `"field": "baseDamage"` vs
`"quality": "reach"` immediately tells you what shape the value should take
without consulting the type. Unifying loses that for a small consistency
gain; with only six kinds, the cost of remembering is low.

**Decision:** keep current names. No change. (If user disagrees, prefer
uniform `field` over uniform `stat` because `field` has no RPG-flavor
implication that conflicts with `combat.attackAttribute` and `quality`.)

---

## Implementation ordering (when ready)

Suggested order, smallest blast radius first:

1. **Item 10 (`kind: "primary"`)** — fundamental pipeline shift (primary derivation must run first). Land before Item 5 so `resolveSetBase` reads the post-derivation primary snapshot.
2. **Item 11 (`secondary.toughness` writes to `.max`)** — trivial; document + authoring sweep + one applicator branch. Can ride alongside Item 10.
3. **Item 5 (universal `setBase` resolution)** — touches `combat.attackAttribute` and `secondary.defense`; do this so Items 2 and 4 inherit a working helper rather than reinventing it.
4. **Item 3 (armor `appliesTo`)** — pure engine bug; isolate or defer behind the bug tracker.
5. **Items 2 + 4 together** — same shape, share one ADR-015 amendment, one schema PR, one set of derived-stage tests; both wire into the Item 5 helper.
6. **Item 9 (rewrite-by-id)** — type change + engine dedupe + lint extension. Land *before* Items 6/8/1 so the bulk re-authoring pass adds `id`, `inflicts`, `isFree`, and inheritance fields in one sweep.
7. **Item 12 (cosmetic conventions)** — docs + authoring sweep + one lint rule. Can ride alongside Item 9 since both touch the bulk re-authoring pass.
8. **Item 6 (`inflicts[]`)** — small type addition + authoring pass.
9. **Item 8 (`isFree`)** — single-field addition + authoring pass; can ride alongside Item 6.
10. **Item 7 (boons/sins effects)** — docs + authoring; no type changes. Can run in parallel with 6/8.
11. **Item 1 (special attacks inheritance)** — touches authored data most heavily; cleanest last so re-authoring happens once with all new fields available.

Each item should land as its own chunk in `phase6-plan.md` with its own PR and
test coverage. Do not bundle.

---

## Item 13 — Roll-time modifier passthrough (`flag` + `appliesTo`; `precise` quality)

### Problem

The engine derives static character state — attributes, secondary stats,
per-slot combat values, the set of active flags and weapon/armor qualities.
It does **not** roll dice and has no representation for "+N to a roll
result." Two recurring patterns surfaced during Chunk F authoring need a
home that doesn't pretend to live in the engine:

1. **`precise` weapon quality** — RPG rules: "+1 to attack roll result"
   (the result, not the die size). Original authoring tried
   `target: { kind: "combat", field: "bonusAttack" }` — `bonusAttack` is
   not a field in `CombatSlotField` and the parser rejected it.
2. **`advantage` flag with weapon scoping** — e.g. Smoke and Mirrors
   novice tier-B grants advantage but only when attacking with short or
   precise weapons. Authored as `target: { kind: "flag", name: "advantage" },
   appliesTo: [...]`. The pre-Item-13 parser silently stripped
   `appliesTo` from non-combat/non-weaponQuality targets.

Both modify *roll results*, which is sibling territory.

### Resolution

Carve the engine/sibling boundary explicitly and surface enough metadata
in the catalog for siblings to act on it without re-parsing English prose.

**(a) Parser change:** `parseAppliesTo` in `src/rules/effects.mts` accepts
`flag` in addition to `combat`/`weaponQuality`. The engine still adds the
flag name to the global character set unconditionally; `appliesTo` is
preserved verbatim on the resolved effect so siblings can read it.
`secondary` and `armorQuality` continue to strip-with-warn.

**(b) Catalog change:** drop the bespoke `effects[]` from
`reference/qualities.{en,ru}.json` `precise` entry. The id appears in
`weapon.qualities[]`; siblings detect it and add +1 to the attack roll
result.

**(c) Spec change:** new §8.5 "Roll-time modifier passthrough" in
`docs/authoring-effects.md` documents the boundary and the two known
patterns (`precise`, `advantage`). §8 `flag` and §9 `WeaponPredicate`
sections cross-reference it.

### Status

✅ Implemented 2026-05-06 alongside this entry. Item 13 ships *outside*
the locked Item 10 → 1 → 12 ordering because it is a one-clause parser
change that unblocks a documentary pattern — no character data shape
churn, no engine math change.

### Affected code & docs

- `src/rules/effects.mts` — `parseAppliesTo` accept-list extended with `flag`.
- `test/rules/effects.test.mts` — added "preserves appliesTo on flag
  targets (documentary metadata)" case.
- `scripts/audit-reference.mts` — `predicateHygiene` no longer flags
  `flag + appliesTo`.
- `docs/authoring-effects.md` — new §8.5 and §8/§9 cross-references.
- `reference/qualities.{en,ru}.json` — `precise.effects` cleared.

### Non-goals

- The engine still does not roll dice or evaluate `appliesTo` against a
  hypothetical attack context — siblings own that. If a future pattern
  needs the engine to *gate* something on the predicate (vs. just emit it),
  that's a separate amendment.
- `armorQuality + appliesTo` is **not** unblocked by Item 13 — that case
  belongs to Item 3 (deferred). The asymmetry is intentional: armor scope
  is the slot, not the weapon.
