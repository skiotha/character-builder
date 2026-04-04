# Deferred Tasks — Effect Normalization, Reference Data, Combat

> Tasks identified during the schema review gate (April 2026) and deferred
> to future sessions. Each section is self-contained and can be tackled
> independently.
>
> **Architectural decisions (April 2026):**
> - [ADR-010](decisions/010-effect-resolution-pipeline.md) — Effect resolution
>   pipeline: explicit phases, typed state, unified effect collection
> - [ADR-011](decisions/011-typed-effect-targets.md) — Typed effect targets:
>   discriminated union replacing dotted-path strings
>
> These ADRs define the foundation that the tasks below build upon. See
> roadmap Phase 6 Step 0 for the implementation plan.

---

## 1. Effect Normalization

### Problem

The reference data files use **free-text effect descriptions** that the rules
engine cannot process. The `Character.effects[]` array and the applicator
expect a canonical shape:

```jsonc
{
  "id":       "string",
  "source":   "ability" | "spell" | "item" | "ritual" | "rule",
  "name":     "string",
  "target":   { "kind": "secondary", "stat": "defense" },  // typed target per ADR-011
  "modifier": {
    "type":  "setBase" | "addFlat" | "multiply" | "cap",
    "value": "resolute" | 5                     // attribute name or number
  },
  "priority":    10,
  "duration":    null
}
```

But the source files store effects like this:

```jsonc
// abilities.en.json — free-text, not machine-readable
{
  "target": "Free Attacks triggered by movement",
  "action": "prevent",
  "value": "movement-related",
  "description": "Quick check to prevent an enemy's free attacks..."
}
```

### What Exists Today

| File | Entries | Effect Structure | Status |
|------|---------|-----------------|--------|
| `data/abilities.en.json` | 169 abilities × 3 tiers | `{ target, action, value, description }` | Free-text, ~507 tier effects |
| `data/abilities.normalized-effects.json` | Same 169 | `{ level, description, actions[] }` with `{ effect, target, value? }` | Partial normalization attempt |
| `data/spells.en.json` | 49 spells × 3 tiers | Same free-text as abilities | ~147 tier effects |
| `data/boons.en.json` | 53 | `description` string only | No structured effects |
| `data/sins.en.json` | 19 | `description` string only | No structured effects |
| `data/rituals.en.json` | 68 | `description` string only | No structured effects |

### Normalization Tiers

Not every effect can be reduced to `{ target, modifier }`. Some effects are
purely narrative (flavor text, RP guidance) and some are mechanical but too
complex for flat modifiers (conditional triggers, multi-step interactions).

**Tier A — Fully Mechanical** (can be expressed as canonical Effect objects):
- Attribute substitution: "Use Discreet instead of Quick for Defense"
  → `{ target: { kind: "secondary", stat: "defense" }, modifier: { type: "setBase", value: "discreet" } }`
- Flat bonuses: "+1d4 damage", "+2 to Cunning checks"
  → `{ target: { kind: "combat", field: "bonusDamage" }, modifier: { type: "addFlat", value: 4 } }`
- Multipliers: "Double your Pain Threshold"
  → `{ target: { kind: "secondary", stat: "painThreshold" }, modifier: { type: "multiply", value: 2 } }`
- Caps: "Defense cannot exceed 10"
  → `{ target: { kind: "secondary", stat: "defense" }, modifier: { type: "cap", value: 10 } }`
- Remove weapon quality: "Unwieldy quality removed from battle heels"
  → `{ target: { kind: "weaponQuality", action: "remove", quality: "unwieldy", weaponFilter: "battle-heels" }, modifier: { type: "remove" } }`

**Tier B — Structured Flags** (machine-readable but not a numeric modifier).
Uses the `flag` target kind per [ADR-011](decisions/011-typed-effect-targets.md):
- Advantage/disadvantage on checks → `{ kind: "flag", flag: "advantage", scope: "..." }`
- Free attack triggers → `{ kind: "flag", flag: "freeAttack" }`
- Extra actions under conditions → `{ kind: "flag", flag: "extraAction" }`
- Immunity to specific effects → `{ kind: "flag", flag: "immunity" }`
- Reactions, special attacks, status effects, status removal

> **Vocabulary defined** in [ADR-011](decisions/011-typed-effect-targets.md):
> `advantage`, `disadvantage`, `immunity`, `freeAttack`, `extraAction`,
> `reaction`, `specialAttack`, `statusEffect`, `statusRemoval`.
> Extensible — new flags can be added to the union type.

**Tier C — Narrative Only** (description text, not reducible):
- RP guidance, situational judgment calls
- DM-adjudicated effects

### Tasks

1. **Categorize all ~507 ability tier effects into Tier A/B/C**
   - Use `abilities.normalized-effects.json` as the starting point
   - Result: annotated file with `tier: "A" | "B" | "C"` per action

2. **Categorize all ~147 spell tier effects into Tier A/B/C**
   - Same approach as abilities

3. **Define structured Tier B vocabulary**
   - Decide on a fixed set of non-modifier effect types:
     `advantage`, `disadvantage`, `freeAttack`, `extraAction`, `immunity`, etc.
   - These won't flow through the modifier pipeline but the UI and addon
     can still interpret them

4. **Convert Tier A effects to canonical shape**
   - Rewrite the `effects` arrays in `abilities.en.json` and `spells.en.json`
   - Each tier effect becomes one or more canonical Effect objects
   - Keep the `description` field for display text

5. **Add structured effects to boons/sins/rituals**
   - Currently these only have `description` strings
   - Some (e.g., Cartographer's "+1 navigation bonus") are clearly Tier A
   - Others are purely narrative — mark as Tier C and leave as description

6. **Align the applicator**
   - `src/rules/applicator.mts` currently uses `add`/`mul`/`set`
   - Must change to `setBase`/`addFlat`/`multiply`/`cap`
   - Add handler for `advantage` flag type
   - **Subsumed by roadmap Phase 6 Step 0 (foundation rework) per
     [ADR-010](decisions/010-effect-resolution-pipeline.md) and
     [ADR-011](decisions/011-typed-effect-targets.md)**

7. **Wire effect resolution into `deriveCombat` and `recalculateDerivedFields`**
   - **Pipeline structure comes from Phase 6 Step 0 (`collectAllEffects`,
     phase-based processing). This task populates it with real data.**
   - When a character has `abilities: [{ id: "twin-attack", tier: "adept" }]`:
     1. Look up `twin-attack` in `abilities.en.json`
     2. Get the `adept` tier's canonical effects
     3. Feed them through the applicator
   - This replaces the old `traits[].effects[]` inline model

### Target File Shapes After Normalization

#### abilities.en.json (post-normalization)

```jsonc
[
  {
    "id": "acrobatics",
    "name": "Acrobatics",
    "category": "ability",
    "description": "Agility, maneuverability, and gymnastic techniques...",
    "tags": ["mobility", "defense", "melee", "quick"],
    "tiers": {
      "novice": {
        "description": "Allows moving past enemies without provoking free attacks.",
        "effects": [
          {
            "tier": "B",
            "target": { "kind": "flag", "flag": "immunity", "scope": "freeAttack.movement" },
            "description": "Quick check to avoid free attacks when moving."
          }
        ]
      },
      "adept": {
        "description": "Removes unwieldy from battle heels.",
        "effects": [
          {
            "tier": "A",
            "target": { "kind": "weaponQuality", "action": "remove", "quality": "unwieldy", "weaponFilter": "battle-heels" },
            "modifier": { "type": "remove" },
            "description": "Remove unwieldy from battle heels."
          }
        ]
      },
      "master": {
        "description": "Use enemy as cover, gain advantage.",
        "effects": [
          {
            "tier": "B",
            "target": { "kind": "flag", "flag": "advantage", "scope": "attacks" },
            "description": "Advantage on next attack when sharing tile with enemy."
          }
        ]
      }
    }
  }
]
```

#### boons.en.json (post-normalization)

```jsonc
[
  {
    "id": "cartographer",
    "name": "Cartographer",
    "tags": ["tracking", "survival", "utility"],
    "levels": 3,
    "description": "Grants +1 bonus on navigation checks...",
    "effects": [
      {
        "tier": "A",
        "target": { "kind": "check", "attribute": "vigilant", "checkType": "navigation" },
        "modifier": { "type": "addFlat", "value": 1 }
      }
    ]
  },
  {
    "id": "blood-bond",
    "name": "Blood Bond",
    "tags": ["corruption", "transformation"],
    "levels": 1,
    "description": "Develop one exotic natural ability...",
    "effects": [
      {
        "tier": "C",
        "description": "Narrative: DM-adjudicated exotic ability choice"
      }
    ]
  }
]
```

---

## 2. Reference Data Files

### Existing Files

| File | Count | Shape |
|------|-------|-------|
| `abilities.en.json` / `.ru.json` | 169 | `{ id, name, category, description, tags[], tiers: { novice, adept, master } }` |
| `spells.en.json` / `.ru.json` | 49 | Same tiered shape as abilities |
| `boons.en.json` / `.ru.json` | 53 | `{ id, name, tags[], levels, description }` |
| `sins.en.json` / `.ru.json` | 19 | `{ id, name, tags[], levels, description }` |
| `rituals.en.json` / `.ru.json` | 68 | `{ id, name, tags[], description }` |
| `abilities.normalized-effects.json` | 169 | Partial normalization attempt, to be replaced |

### Missing Files

#### `data/weapons.en.json`

Canonical weapon reference data. Characters store `equipment.weapons: Weapon[]`
with inline weapon objects. This reference file provides the pick-list for the
UI weapon selector and validates weapon properties.

```jsonc
[
  {
    "id": "longsword",
    "name": "Longsword",
    "type": "heavy",
    "damage": 8,
    "qualities": ["long"]
  },
  {
    "id": "stiletto",
    "name": "Stiletto",
    "type": "light",
    "subtype": "dagger",
    "damage": 4,
    "qualities": ["precise", "short", "concealed"]
  },
  {
    "id": "crossbow",
    "name": "Crossbow",
    "type": "ranged",
    "subtype": "crossbow",
    "damage": 8,
    "qualities": ["massive"]
  },
  {
    "id": "battle-heels",
    "name": "Battle Heels",
    "type": "light",
    "damage": 4,
    "qualities": ["short", "unwieldy"]
  },
  {
    "id": "staff",
    "name": "Staff",
    "type": "staff",
    "damage": 6,
    "qualities": ["long", "blunt"]
  }
  // ...
]
```

**Fields**:
- `id` — unique string identifier
- `name` — display name
- `type` — weapon category: `"heavy"`, `"light"`, `"staff"`, `"spear"`, `"ranged"`, `"unarmed"`
- `subtype` — optional refinement: `"dagger"`, `"stiletto"`, `"short bow"`, `"crossbow"`, `"revolver"`
- `damage` — die size as number (4 = d4, 6 = d6, 8 = d8, etc.)
- `qualities` — string array: `"long"`, `"short"`, `"precise"`, `"massive"`, `"blunt"`, `"entangling"`, `"concealed"`, `"unwieldy"`, etc.

#### `data/armor.en.json`

Canonical armor reference data. `equipment.armor.body` and `equipment.armor.plug`
reference these.

```jsonc
[
  {
    "id": "leather-armor",
    "name": "Leather Armor",
    "slot": "body",
    "defense": 2,
    "qualities": ["light"]
  },
  {
    "id": "chainmail",
    "name": "Chainmail",
    "slot": "body",
    "defense": 4,
    "qualities": ["cumbersome"]
  },
  {
    "id": "blessed-robe",
    "name": "Blessed Robe",
    "slot": "body",
    "defense": 0,
    "qualities": ["mystical"]
  },
  {
    "id": "steel-buckler",
    "name": "Steel Buckler",
    "slot": "plug",
    "defense": 0,
    "qualities": ["reinforced"]
  }
  // ...
]
```

**Fields**:
- `id` — unique string identifier
- `name` — display name
- `slot` — `"body"` or `"plug"` (plug = auxiliary armor, no base defense, carries special qualities)
- `defense` — armor value (0 for plug-type armor)
- `qualities` — string array: `"light"`, `"cumbersome"`, `"mystical"`, `"reinforced"`, etc.

#### `data/runes.en.json`

Runic tattoo reference data. Characters can have max 3 runes.

```jsonc
[
  {
    "id": "rune-of-fire",
    "name": "Rune of Fire",
    "description": "Burns enemies on contact.",
    "qualities": ["fire", "damage"]
  },
  {
    "id": "rune-of-warding",
    "name": "Rune of Warding",
    "description": "Provides mystic protection.",
    "qualities": ["protection", "mystical"]
  }
  // ...
]
```

**Fields**:
- `id` — unique string identifier
- `name` — display name
- `description` — flavor text
- `qualities` — string array of tagged properties

#### `data/traditions.en.json` (optional)

May not be needed as a separate file if traditions are just curated ability IDs.
Traditions are specific abilities (6+1 total) that reduce corruption from
learning spells of their school.

```jsonc
[
  { "id": "wizardry",   "name": "Wizardry",   "abilityId": "wizardry" },
  { "id": "sorcery",    "name": "Sorcery",    "abilityId": "sorcery" },
  { "id": "theurgy",    "name": "Theurgy",    "abilityId": "theurgy" },
  { "id": "witchcraft", "name": "Witchcraft", "abilityId": "witchcraft" },
  { "id": "staff-magic","name": "Staff Magic","abilityId": "staff-magic" },
  { "id": "symbolism",  "name": "Symbolism",  "abilityId": "symbolism" },
  { "id": "troll-singing","name": "Troll Singing","abilityId": "troll-singing" }
]
```

**Decision needed**: Is a separate file worth it, or should `traditions[]` on
the character just store ability IDs and the UI filters the abilities list?

### Russian Localization

Every `.en.json` file has a corresponding `.ru.json` with identical structure
but translated `name` and `description` fields. New reference files should
follow the same pattern: `weapons.en.json` + `weapons.ru.json`, etc.

---

## 3. Combat Dual-Wield Refinement

### Current State

The `Combat` interface and `deriveCombat()` stub:

```typescript
// rpg-types.mts
interface Combat {
  attackAttribute: PrimaryAttributeName;  // e.g., "accurate"
  baseDamage: number;                      // die size (8 = d8)
  bonusDamage: number[];                   // extra dice from abilities
  weapons: number[];                       // indices into equipment.weapons[]
}
```

```typescript
// derived.mts — current stub
function deriveCombat(character): void {
  const primaryIndex = weaponSlots[0];                    // ← only first weapon
  const primaryWeapon = weapons[primaryIndex];

  combat.attackAttribute = combat.attackAttribute || "accurate";
  combat.baseDamage = primaryWeapon?.damage ?? 0;         // ← single weapon only
  combat.bonusDamage = combat.bonusDamage || [];          // ← always empty
}
```

### What `combat.weapons` Means

- `[]` — unarmed / no weapon equipped
- `[0]` — single weapon (weapon at `equipment.weapons[0]`)
- `[0, 1]` — dual-wield (weapons at slots 0 and 1)

The `weapons` array is **not derived** — the player sets it via the UI to
choose active weapon(s). The rest of combat is derived from those choices.

### What Needs to Change

#### 3a. Multi-weapon damage aggregation

When `combat.weapons = [0, 1]` (dual-wield), `deriveCombat` should:

1. Read both `equipment.weapons[0]` and `equipment.weapons[1]`
2. Set `baseDamage` from the **primary** weapon (first index)
3. Add the secondary weapon's damage die to `bonusDamage`

Example:
```
weapons[0] = Longsword (damage: 8)
weapons[1] = Dagger (damage: 4)
combat.weapons = [0, 1]

→ baseDamage = 8      (primary weapon)
→ bonusDamage = [4]   (secondary weapon adds d4)
```

For single weapon:
```
weapons[0] = Longsword (damage: 8)
combat.weapons = [0]

→ baseDamage = 8
→ bonusDamage = []
```

#### 3b. Attack attribute resolution

`attackAttribute` defaults to `"accurate"` but abilities can change it:
- Certain abilities substitute a different attribute for attacks
  (e.g., "use Discreet instead of Accurate for melee attacks")
- This is a **Tier A** canonical effect: `{ target: { kind: "combat", field: "attackAttribute" }, modifier: { type: "setBase", value: "discreet" } }`
- **Depends on effect normalization** (Task 1) — can remain hardcoded "accurate" until then

#### 3c. Bonus damage from abilities

Some abilities grant extra damage dice at higher tiers. For example:
- "Steel Fist (Master): +d4 bonus damage on unarmed attacks"
- "Sharp Tongue (Adept): +d6 damage with dual daggers"

These should push additional die sizes into `bonusDamage[]`.

Flow:
1. Character has `abilities: [{ id: "steel-fist", tier: "master" }]`
2. Look up `steel-fist` master tier in `abilities.en.json`
3. Find canonical effect `{ target: { kind: "combat", field: "bonusDamage" }, modifier: { type: "addFlat", value: 4 } }`
4. Push `4` into `bonusDamage` array

**Depends on effect normalization** (Task 1) — leave `bonusDamage` empty until effects are canonical.

### Implementation Order

| Step | Task | Depends On |
|------|------|------------|
| 3a | Multi-weapon damage in `deriveCombat` | Nothing — can do now |
| 3b | Attack attribute from effects | Effect normalization (Task 1) |
| 3c | Bonus damage from ability effects | Effect normalization (Task 1) |

### Proposed `deriveCombat` After Step 3a

```typescript
function deriveCombat(character: Record<string, unknown>): void {
  const combat = (character.combat || {}) as Record<string, unknown>;
  character.combat = combat;

  const equipment = character.equipment as Record<string, unknown> | undefined;
  const weapons = (equipment?.weapons || []) as Array<Record<string, unknown>>;
  const weaponSlots = (combat.weapons || []) as number[];

  // Primary weapon → baseDamage
  const primaryWeapon = weaponSlots[0] !== undefined
    ? weapons[weaponSlots[0]]
    : undefined;
  combat.baseDamage = (primaryWeapon?.damage as number) ?? 0;

  // Secondary weapons → bonusDamage (dual-wield dice)
  const bonusDice: number[] = [];
  for (let i = 1; i < weaponSlots.length; i++) {
    const weapon = weapons[weaponSlots[i]];
    if (weapon?.damage) bonusDice.push(weapon.damage as number);
  }
  // TODO: append ability-granted bonus dice here (after effect normalization)
  combat.bonusDamage = bonusDice;

  // TODO: resolve from effects (after effect normalization)
  combat.attackAttribute = combat.attackAttribute || "accurate";
}
```
