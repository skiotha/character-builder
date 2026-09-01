# Nagara Character Builder — Data Contracts

> Canonical data shapes for the character builder and its consumers.
> Cross-project integration details live in
> [addon-integration.md](addon-integration.md) (addon-authored) and
> [bot-integration.md](bot-integration.md) (bot-authored).
> This document owns the **wire shapes**; the RPG-system facts behind them
> (attribute formulas, setBase resolution, phase order, the
> declarative-actions boundary) live in
> [rpg-engine-semantics.md](rpg-engine-semantics.md) — cite `ES §<anchor>`.

---

## 1. Character Schema

The full character object as stored in `data/characters/<id>.json`.
This is the **source of truth** — all other formats derive from it.

```jsonc
{
  // ── Server-controlled metadata ──
  "id":            "uuid",              // generated, immutable
  "backupCode":    "Adjective-Noun-NNNN",// generated, recovery credential
  "playerId":      "string",            // self-asserted player identity (see ADR-003)
  "player":        "string",            // display name
  "created":       "ISO-8601",          // set once on creation
  "lastModified":  "ISO-8601",          // updated on every save
  "schemaVersion": 2,                   // wire format version for cross-project compat

  // ── Identity ──
  "characterName": "string",            // 3–16 chars, letters/spaces/hyphens/apostrophes

  // ── Attributes ──
  "attributes": {
    "primary": {                        // player-authored base; validated 5–15
      "accurate":  5,                   // 5–15, integer, budget total = 80
      "cunning":   5,
      "discreet":  5,
      "appealing":  5,
      "quick":     5,
      "resolute":  5,
      "vigilant":  5,
      "strong":    5
    },
    "primaryEffective": {               // server-controlled; derived = primary + `kind: "primary"` effects (addFlat, cap)
      "accurate":  5,                   //   may exceed 15; never sent in POST/PATCH bodies (stripped server-side)
      "cunning":   5,                   //   all downstream engine stages (formulas, combat) read from here
      "discreet":  5,
      "appealing":  5,
      "quick":     5,
      "resolute":  5,
      "vigilant":  5,
      "strong":    5
    },
    "secondary": {                      // all derived from primaryEffective + effects
      "toughness": {
        "max":     10,                  // max(strong, 10)
        "current": 10                   // 0 ≤ current ≤ max
      },
      "painThreshold":       5,         // ceil(strong / 2)
      "corruptionThreshold": 5,         // ceil(resolute / 2)
      "defense":             5,         // = quick (before modifiers)
      "armor":               0,         // derived from equipment.armor.body.defense
      "corruptionMax":       10         // = resolute (before modifiers)
    }
  },

  // ── Progression ──
  "experience": {
    "total":   50,                      // min 50, integer
    "unspent": 0                        // min 0, integer
  },
  "corruption": {
    "permanent": 0,                     // min 0, integer
    "temporary": 0                      // min 0, integer
  },

  // ── Learned Traits & Talents ──
  "traits":     [],                    // array of { id: string, tier: "novice"|"adept"|"master", source: "ability"|"spell" }
  "rituals":   [],                      // array of { id: string, level: number }
  "talents":   [],                      // array of { id: string, level: number, source: "sin"|"boon" }

  // ── Effects (runtime) ──
  "effects":     [],                    // array of effect objects (see §1.1)

  // ── Mystical Traditions ──
  "traditions":  [],                    // array of tradition name strings

  // ── Combat (ADR-014: per-slot) ──
  // The 3-slot `carried` tuple is the ONLY writable combat surface.
  // The own slot (index 2) is required and must reference a weapon with
  // the `own` quality.
  // Per-slot derived fields (attackAttribute / baseDamage / bonusDamage /
  // qualities / flags) plus top-level specialAttacks / reactions are
  // pure recalc output — present in API responses, NOT in PATCH payloads.
  "combat": {
    "carried": [
      null,                             // index 0 — main-hand: { "weaponIndex": number } | null
      null,                             // index 1 — off-hand:  { "weaponIndex": number } | null
      { "weaponIndex": 0 }              // index 2 — own: required, references own-quality weapon
    ]
  },

  // ── Server-derived attribute pointers (ADR-015 §3c, §3d) ──
  // Names of the primary attributes used by sibling apps for spell-power
  // and initiative rolls. Defaults: "resolute" / "quick". Mutable only
  // via setBase effects on `magicAttribute` / `initiativeAttribute`
  // targets; resolution is max-by-primary with the default included.
  // serverControlled — present in API responses, NOT in PATCH payloads.
  "magicAttribute":      "resolute",
  "initiativeAttribute": "quick",

  // ── Equipment ──
  "equipment": {
    "money":      0,                    // non-negative number
    "weapons":    [],                   // array of Weapon objects
    "ammunition": [],
    "armor": {
      "body": null,                     // ArmorPiece object or null
      "plug": null                      // ArmorPiece object or null
      // ArmorPiece shape:
      //   { id, name, armor, qualities: string[], cost?, effects?,
      //     qualitiesEffective?: string[] }
      //   `qualitiesEffective` is the engine-resolved overlay produced
      //   by armorQuality add/remove effects (ADR-015 §3f). It is
      //   serverControlled — reset from `qualities` at the top of every
      //   recalc; consumers should fall back to `qualities` when absent.
    },
    "runes":      [],                   // array of Rune objects (max 3)
    "assassin":   [],                   // specialist equipment (formerly professional.assassin)
    "tools":      [],                   // utility tools (formerly professional.utility)
    "inventory": {
      "carried": [],                    // on-person items (formerly inventory.self)
      "home":    []                     // stored items
    },
    "artifacts":  []
  },

  // ── Background ──
  "background": {
    "race":       "",                   // required string
    "shadow":     "",
    "age":        0,                    // required, min 0, integer
    "profession": "",
    "journal": {
      "open":    [],
      "done":    [],
      "rumours": []
    },
    "notes":    [],
    "kinkList": []
  },

  // ── Location ──
  "location": "",

  // ── Affiliations ──
  "affiliations": [],                   // array of { name: string, reputation: number }

  // ── Portrait ──
  "portrait": {
    "path":   "",                       // server-controlled, file path
    "crop": {
      "x":        0.0,                  // horizontal offset
      "y":        0.0,                  // vertical offset
      "scale":    1.0,                  // zoom factor (> 0)
      "rotation": 0.0                   // degrees
    },
    "dimensions": {
      "width":  0,                      // pixels, non-negative integer
      "height": 0
    },
    "status": ""                        // server-controlled
  }
}
```

### 1.1 Effect Object

The canonical shape is locked in [ADR-015 — Typed Effect Targets, Final Vocabulary](decisions/015-typed-effect-targets-final.md) (supersedes ADR-011) and [ADR-014 — Per-Slot Combat, Special Attacks & Reactions](decisions/014-per-slot-combat-special-attacks.md). Practical authoring guidance — worked examples for every `EffectTarget` kind, `WeaponPredicate` / `condition` placement rules, and the `SpecialAttack` / `Reaction` wire shape — is in [`docs/reference-authoring.md`](reference-authoring.md).

```jsonc
{
  "id":          "string",
  "source":      "ability" | "spell" | "item" | "ritual" | "rule",
  "name":        "string",
  "description": "string",
  "target":      EffectTarget,          // typed discriminated union, see below
  "modifier":    EffectModifier,        // per-phase shape, see below
  "duration":    null                   // engine-ignored; effect lifecycle is sibling-owned (NB-35)
}
```

The legacy dotted-path `target` strings, the `add`/`mul`/`set` modifier verbs, and the `priority` field are removed (ADR-015 §4). Phase order replaces priority (ES §phase-order); effects within a single phase are commutative. `duration` rides the wire untouched — the engine applies every effect it can parse regardless of expiry; lifecycle modelling belongs to sibling apps (ES §out-of-engine).

#### `EffectTarget` (8-kind discriminated union)

| `kind`                | Shape                                              | Notes                                                                                                                                       |
| --------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `primary`             | `{ kind: "primary", stat: PrimaryName }`           | `addFlat` / `cap` only; own pre-pipeline phase writing `attributes.primaryEffective` (ADR-015 §3e).                                          |
| `secondary`           | `{ kind: "secondary", stat: SecondaryName }`       | `toughness`, `defense`, `armor`, `painThreshold`, `corruptionThreshold`, `corruptionMax`. Gated by `condition?: ArmorCondition[]` (ADR-015 §3f). |
| `combat`              | `{ kind: "combat", field: CombatField }`           | `baseDamage`, `bonusDamage`, `attackAttribute` (`setBase` only). Narrowed per slot by `appliesTo`.                                           |
| `weaponQuality`       | `{ kind: "weaponQuality", quality: string }`       | Adds/removes a quality on weapons matching every `WeaponPredicate` in `appliesTo` (ADR-015 §3a).                                             |
| `armorQuality`        | `{ kind: "armorQuality", quality: string }`        | Adds/removes a quality per armor piece; gated by `condition?: ArmorCondition[]` (ADR-015 §3f) — there is **no** `slot` key.                  |
| `flag`                | `{ kind: "flag", name: string }`                   | Set-membership toggle consumed by rules / UI (ADR-015 §3a).                                                                                  |
| `magicAttribute`      | `{ kind: "magicAttribute" }`                       | `setBase` only — re-points the spell-power roll attribute (ES §magic-initiative).                                                            |
| `initiativeAttribute` | `{ kind: "initiativeAttribute" }`                  | `setBase` only — same mechanism for initiative rolls.                                                                                        |

`appliesTo` and `condition` live on the **effect object**, not inside the target; the per-kind accept-list is ADR-015 §placement-table.

`CheckTarget` is dropped — checks are derived from primaries/secondaries, not modified directly.

#### `WeaponPredicate` (AND-composed)

```jsonc
{ "kind": "type" | "quality" | "id", "values": ["string"] }   // or { "kind": "any" } (no values)
```

`appliesTo: WeaponPredicate[]` is AND-composed across entries, OR within `values[]`; default is a single `{ kind: "any" }`. Predicate `kind: "subtype"` is **not** part of the vocabulary.

> **Conditional secondaries are skipped.** `appliesTo` narrows per-slot
> `combat` / `weaponQuality` / `flag` effects. On a character-level
> `secondary` target the engine has no per-slot context in which to
> evaluate the predicate, so it **skips** any `secondary` effect that
> carries an `appliesTo` (applying it unconditionally would bake a
> sometimes-true bonus into the aggregate — e.g. a "+1 defense while
> wielding a staff" would otherwise apply bare-handed). The effect and its
> predicate still ride to sibling apps as documentary data; a UI surface
> is deferred. Tracked in NB-34; system rationale in ES §conditional-secondary.

#### `EffectModifier` (per phase)

| `type`       | Shape                                          | Phase                       |
| ------------ | ---------------------------------------------- | --------------------------- |
| `setBase`    | `{ type: "setBase", value: string }`           | Base swap — `value` is a **primary-attribute name**; competing candidates resolve default-inclusive max-by-primary (ADR-015 §4a, ES §setbase). |
| `addFlat`    | `{ type: "addFlat", value: number }`           | Flat add after formula.     |
| `multiply`   | `{ type: "multiply", value: number }`          | Multiplicative.             |
| `cap`        | `{ type: "cap", value: number }`               | Upper bound.                |
| `remove`     | `{ type: "remove" }`                           | Strikes a quality / flag.   |

Invariant: negatives are only ever **removed**; positives only ever **added**. This is what makes dropping `priority` safe.

#### Canonical reference vocabularies

Sourced from the reference catalogs in `reference/`:

| Domain          | Allowed values                                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Weapon `type`   | See `reference/weapons.{locale}.json` `type` field. Includes `melee`, `ranged`, `thrown`, `natural`, etc.                                                       |
| Weapon `quality`| See `reference/weapons.{locale}.json` `qualities`. Includes `own` (restricted to `natural_weapon`, `war_claws`, `heels`).                                       |
| Weapon `id`     | `id` field of any entry in `reference/weapons.{locale}.json`.                                                                                                   |
| Armor `quality` | See `reference/armor.{locale}.json` `qualities`. Includes `hampering` (single literal, no `_N` suffix — magnitude is implicit in the armor's `armor` value).    |
| Armor `slot`    | `body` \| `plug`. **There is no `armor.type` field.**                                                                                                       |
| Quality `id`    | See `reference/qualities.{locale}.json` (ADR-016). Single namespace shared by weapons and armor; parametric variants use `_N` suffix (e.g. `fortified_2`).      |

The armor reference field formerly named `defense` is now `armor` — it is the mitigation source for `secondary.armor`. The transition fallback for `equipment.armor.body.defense` was removed; existing characters must be re-saved or wiped.

#### Validation contract (writes)

Catalog membership is **strict** — reference catalogs are the sole source
of truth and neither the website UI nor sibling apps may invent items:

- Every id in `equipment.weapons[]`, `equipment.armor.body/.plug`,
  `traits[]`, `talents[]`, `rituals[]`, and `traditions[]` must resolve in
  its catalog; every item `qualities[]` id must resolve in the quality
  registry (ADR-016).
- Structural rules ride along: armor entry `slot` must match its position;
  trait `tier ∈ {novice, adept, master}` with `source` consistent with
  where the id resolved; talent `level` within `1..levels` from the
  catalog entry; base primaries each 5–15 summing to exactly 80
  (ES §primaries); `0 ≤ toughness.current ≤ toughness.max`.
- Rejection vocabulary: creation failures return **400** naming the
  offending id/field; PATCH failures return **422** (all-or-nothing —
  "Some updates failed"). Client-supplied server-controlled fields at
  creation are warn-and-ignored, not rejected.
- `effects[]` is deliberately exempt: malformed entries are warn-and-skip
  at recalc, never a write error (the raw boundary is the NB-35 design).

#### Combat shape (ADR-014)

Writable storage shape — the only thing PATCH accepts:

```jsonc
{
  "carried": [Slot | null, Slot | null, Slot]   // exactly 3 entries; own slot (index 2) required
}
```

Where `Slot = { "weaponIndex": number }` (no other inner keys are accepted).
The own slot (index 2) must reference a weapon in `equipment.weapons` with
the `own` quality (default `natural_weapon`, seeded at index 0 on creation).

Derived (recalc-only, present in API responses but rejected on PATCH):

- Per-slot inner fields: `attackAttribute`, `baseDamage`, `bonusDamage`,
  `qualities`, `flags`.
- Top-level `flags`, `specialAttacks`, `reactions` arrays on the character.

The combat phase fans out per slot; `SpecialAttack[]` and `Reaction[]`
are distinguished by `trigger === "manual"`. Tier stacking is additive.
Full shape documented in ADR-014.

Each entry in `specialAttacks` / `reactions` carries a required
`id: string` that the engine uses as a rewrite key — same id at a
higher tier of the same parent ability/spell replaces the lower
(ADR-014 §9). Sibling apps consume these arrays verbatim and do not
re-dedupe. The `Action` shape is:

```jsonc
{
  "id": "string",                            // required, locale-independent
  "name": "string",
  "description": "string",                   // optional
  "trigger": "manual" | "onAttacked" | ...,
  "attackAttribute": "strong" | ...,         // optional — bespoke override; absent ⇒ inherit from carrying weapon
  "damage": 4,                               // optional — bespoke override (number or dice); absent ⇒ inherit
  "damageBonus": 4,                          // optional — flat bonus added on top of inherited base damage (Backstab pattern)
  "ignoresArmor": true,                      // optional, manual triggers only — bypasses target armor
  "inflicts": ["bleeding", "stunned"],       // optional — status ids from reference/statuses.{locale}.json; engine declares, siblings model lifecycle
  "isFree": true,                            // optional, manual triggers only — does not consume the action economy
  "appliesTo": [ /* WeaponPredicate[] */ ],   // optional — narrows which carried slots the action applies to (AND-list, OR within values[])
  "effects": [ /* ResolvedEffect[] */ ]       // optional
}
```

`damageBonus`, `ignoresArmor`, `inflicts`, `isFree`, and `appliesTo`
are declarative fields. The engine carries them through to sibling apps
verbatim and **never** inlines weapon stats into an action: sibling apps
resolve `damageBonus` / `ignoresArmor` / `appliesTo` — and the omitted
`damage` / `attackAttribute` defaults — against the **live** carried
weapon at play time. Weapon swaps are sibling-side and not persisted
per-swap (ADR-014), so any value inlined at save time would go stale on
the next swap. Passive per-slot weapon stats stay engine-computed
(`deriveCombatSlots`); actions are declarative.

`inflicts[]` entries are validated against the canonical status
registry (`reference/statuses.{en,ru}.json`, served at
`/api/v1/statuses`) by `test/rules/reference-lint.test.mts`. Statuses are
display-only metadata — the engine does not model duration, stacking,
or saves; sibling combat resolvers own that.

The audit lint enforces: `damageBonus` requires non-empty `appliesTo`;
`ignoresArmor` / `isFree` are rejected on non-`manual` triggers.

> The pre-Item-9 drafts of ADR-014 included a structured `source`
> field on `Action`. It was never read by the engine and was dropped;
> sibling code that previously read it should switch to ignoring its
> absence (no replacement is needed).

### 1.2 Learned Trait / Talent / Ritual

Traits (abilities and spells) use a tier model with a source discriminator:
```jsonc
{ "id": "string", "tier": "novice" | "adept" | "master", "source": "ability" | "spell" }
```

Talents (sins and boons) use a level model with a source discriminator:
```jsonc
{ "id": "string", "level": 1, "source": "sin" | "boon" }
```

> **Talent engine stance.** Talents contribute only the flat top-level
> `effects[]` (flags) authored on the boon / sin — the engine applies them
> via `collectAllEffects` → `lookupTalent`. Numeric `level` is carried for
> sibling apps but is **not** engine-scaled (no talent currently carries a
> numeric-target effect; flags ignore their numeric value per ADR-015 §3a).
> Many check-bonus talents (Actor, Powerful Voice, Deceiver, …) carry no
> `effects[]` at all, so siblings can only key off "talent present +
> level." Tracked in NB-47.

Rituals use a level model:
```jsonc
{ "id": "string", "level": 1 }
```

The `id` references the canonical definition in the corresponding reference data file (e.g. `reference/abilities.{locale}.json` for traits with `source: "ability"`).

---

## 2. Permission Model

Each field in the schema has a `permissions` map with per-role read/write access:

```jsonc
{
  "owner":  { "read": true, "write": true },
  "dm":     { "read": true, "write": true },
  "public": { "read": true, "write": false }
}
```

- `read: true` — role can see the field value
- `write: true` — role can modify the field value
- `read: false` — field is hidden from this role
- `write: false` — field is read-only for this role

Roles are determined per-request:
- **dm**: `x-dm-id` header matches the server's `NAGARA_DM_TOKEN`
- **owner**: `x-player-id` header matches the character's `playerId`
- **public**: everyone else

Fields marked `serverControlled: true` cannot be set by any client — they are generated and maintained by the server (id, backupCode, created, lastModified, portrait.path, portrait.status).

### Backup code format

The `backupCode` is the user-facing recovery credential, formatted as
`Adjective-Noun-NNNN` (e.g. `Crimson-Wyvern-0473`). The keyspace is at least
20 adjectives × 20 nouns × 10 000 numbers (≈ 4 000 000+ combinations). The
format is **forward-only**: previously issued codes (e.g. older 3-digit
suffix variants) remain valid forever — the server resolves them by exact
string match against the index. Sibling projects must not parse or
validate the format; treat the value as an opaque string.

Common permission patterns:
- **Read-write** (most owner fields): `{ read: true, write: true }` for owner/dm, `{ read: true, write: false }` for public
- **Read-only** (derived/server-controlled): `{ read: true, write: false }` for all roles
- **Private** (identity fields): `{ read: false, write: false }` for public

---

## 3. API Contract

**Base path:** `/api/v1`

### 3.1 Characters

| Method   | Path                           | Auth        | Body / Query                    | Response                |
| -------- | ------------------------------ | ----------- | ------------------------------- | ----------------------- |
| `GET`    | `/characters`                  | player / DM | `?playerId=`                    | `200` character array   |
| `GET`    | `/characters/:id`              | player / DM | —                               | `200` character object  |
| `POST`   | `/characters`                  | player      | character creation data         | `201` character object  |
| `PATCH`  | `/characters/:id`              | owner / DM  | `{ updates: [...] }`           | `200` character object  |
| `DELETE` | `/characters/:id`              | owner / DM  | —                               | `200` deletion result   |
| `POST`   | `/characters/:id/portrait`     | owner / DM  | multipart image                 | `200` portrait path     |
| `GET`    | `/characters/:id/stream`       | any         | —                               | SSE stream              |

### 3.2 Schema

| Method | Path                        | Auth | Response                          |
| ------ | --------------------------- | ---- | --------------------------------- |
| `GET`  | `/schema`                   | none | schema + UI metadata (JSON, ETag) |

The schema endpoint serves the character field definitions together with
UI rendering metadata (see [ADR-009](decisions/009-schema-driven-rendering.md)).
The client fetches it once, caches via `ETag` / `If-None-Match`, and uses
it to render all character-related forms from `(schema, data, role)`.

> **Legacy:** Earlier versions exposed `/view/*` endpoints returning
> server-rendered HTML fragments. They were removed when schema-driven
> rendering ([ADR-009](decisions/009-schema-driven-rendering.md)) shipped;
> the server is now a pure JSON API.

### 3.3 Reference Catalogs

| Method | Path                | Auth | Source                                        |
| ------ | ------------------- | ---- | --------------------------------------------- |
| `GET`  | `/traits`           | none | merged `abilities` + `spells` (`source` stamped) |
| `GET`  | `/talents`          | none | merged `boons` + `sins` (`source` stamped)    |
| `GET`  | `/rituals`          | none | `reference/rituals.{locale}.json`             |
| `GET`  | `/weapons`          | none | `reference/weapons.{locale}.json`             |
| `GET`  | `/armor`            | none | `reference/armor.{locale}.json`               |
| `GET`  | `/qualities`        | none | `reference/qualities.{locale}.json` (ADR-016) |

All reference endpoints accept `?locale=` (`en`/`ru`); fall back to
`Accept-Language`, then to `en`. Unknown locales return `400`. Files
under `reference/` are **not** served as static files.

A locale-drift lint test (`test/reference-locale-drift.test.mts`) keeps
the `{en,ru}` pairs structurally aligned: same id set, same ordering,
and only the allowlisted localized fields (`name`, `description`,
`tags`) may differ. The engine never reads any of those fields.

### 3.4 Other

| Method | Path                        | Auth | Response                 |
| ------ | --------------------------- | ---- | ------------------------ |
| `POST` | `/validate-dm`              | DM   | validation result        |
| `POST` | `/recover`                  | none | character (by name+code) |

### 3.5 Planned Endpoints (not yet implemented)

| Method | Path                                | Auth   | Purpose                               | Source             |
| ------ | ----------------------------------- | ------ | ------------------------------------- | ------------------ |
| `GET`  | `/characters/:id/export/addon`      | owner/DM | Export character for WoW addon       | addon-integration §2 |
| `POST` | `/characters/:id/import/addon`      | owner/DM | Update character from addon export   | addon-integration §5 |
| `POST` | `/characters/:id/sync`              | DM     | DM sync script upload                 | addon-integration §6 |

### 3.6 Update Payload Format

The `PATCH` endpoint accepts an array of field-level updates:

```jsonc
{
  "updates": [
    { "field": "characterName", "value": "Arianna" },
    { "field": "attributes.primary.strong", "value": 12 },
    { "field": "equipment.weapons", "value": [...], "operation": "replace" }
  ]
}
```

Each update is validated individually against the schema and the caller's role.

---

## 4. Character Index

The in-memory index (`data/index.json`) provides fast lookups without
reading every character file.

```jsonc
{
  "byId": {
    "<uuid>": {
      "name": "string",
      "playerId": "string",
      "backupCode": "string",
      "created": "ISO-8601",
      "deleted": false,
      "deletedAt": null
    }
  },
  "byBackupCode": { "<code>": "<uuid>" },
  "byPlayer":     { "<playerId>": ["<uuid>", ...] },
  "all":          ["<uuid>", ...]
}
```

---

## 5. Cross-Project Formats

### 5.1 Addon Export (Website → Addon)

Detailed in [addon-integration.md §2–4](addon-integration.md).

Summary: character data stripped of server-internal / addon-irrelevant fields,
serialized as `Base64(JSON.stringify(characterTable))` (JSON path) or
`Base64(LuaSerialize(characterTable))` (Lua path). Decision pending — JSON
path is simpler for the website side.

### 5.2 Addon Import (Addon → Website)

Detailed in [addon-integration.md §5](addon-integration.md).

Reverse of §5.1. Player pastes an addon export string into the website.

### 5.3 DM Sync (Addon → Website, automated)

Detailed in [addon-integration.md §6](addon-integration.md).

POST per-character JSON data with DM Bearer token. Conflict resolution
based on `lastModified` comparison.

### 5.4 Discord Bot (Website ↔ Malizia)

Detailed in [bot-integration.md](bot-integration.md).

The bot and website run on the **same VPS**. The bot reads character data
directly from the website's `data/` directory (filesystem reads — no API
round-trips). Write operations go through the website's `PATCH` API to
preserve validation, derived-stat recalculation, and SSE broadcasts.

| Direction        | Mechanism                      | Format |
| ---------------- | ------------------------------ | ------ |
| Website → Bot    | Filesystem reads (local)       | JSON   |
| Bot → Website    | `PATCH /api/v1/characters/:id` | JSON   |

**Schema dependency:** The bot depends on the structure of `index.json`
and character JSON files. A `discordId` field must be added to the
character schema to map Discord users to characters (see
bot-integration.md §3).

**Portrait access:** The bot embeds character portraits in Discord
messages by constructing public HTTPS URLs from `portrait.path`.
