# Nagara Website — Addon Integration Specification

> Requirements the WoW addon places on the website.
> This document lives in the website repo. It was originally authored by
> the addon side; **addon development is paused until the website roadmap
> completes**, so it is currently maintained website-side — the contract
> content below reflects the server as shipped, with sibling-side review
> owed when addon work resumes. The endpoints in §2, §5 and §6 are
> specified but **not yet implemented**; that work is deferred to the
> sibling-resume milestone.
> Addon-side contracts and architecture:
> [`nagara-addon/docs/data-contracts.md`](https://github.com/skiotha/nagara-addon/blob/main/docs/data-contracts.md),
> [`nagara-addon/docs/architecture.md`](https://github.com/skiotha/nagara-addon/blob/main/docs/architecture.md).

---

## 1. Overview

Three Nagara subsystems exchange data:

```
  Website  ◄───────►  Addon (WoW)  ◄────►  Other Players (in-game comm)
     ▲
     │
  Discord Bot (out of scope here)
```

The website is the **canonical long-term store** for character data.
The addon is a **session-time consumer and editor** of that data.
Data flows in both directions:

| Direction       | Mechanism                | Actor      |
| --------------- | ------------------------ | ---------- |
| Website → Addon | Paste-import string      | Any player |
| Addon → Website | Paste-export string      | Any player |
| Addon → Website | DM sync script (primary) | DM only    |

---

## 2. Endpoint: Character Export for Addon

**New.** Does not exist yet.

```
GET /api/v1/characters/:id/export/addon
```

### 2.1 Behavior

1. Fetch the character by `:id`.
2. Verify the caller has owner or DM access (existing auth middleware).
3. Strip excluded fields (§2.2).
4. Serialize the remaining data into the addon's wire format (§4).
5. Return the result as a plain-text response body.

### 2.2 Response

```
Content-Type: text/plain; charset=utf-8
Body: <base64-encoded serialized character>
```

The UI will likely consume this through a copyable text box or a "copy to clipboard" button, rather than requiring users to hit the raw API.

### 2.3 Fields to Include

Every field in the character schema **except** the ones listed below. This roughly corresponds to the existing `owner`-visible permission set, minus server-internal metadata.

### 2.4 Fields to Exclude

These must be **stripped** before serialization. They either contain server-internal data or information the addon cannot use.

| Field                  | Reason                                        |
| ---------------------- | --------------------------------------------- |
| `playerId`             | Website-internal identity, unused in-game     |
| `player`               | Website display name; addon uses WoW names    |
| `backupCode`           | Sensitive recovery code, not relevant in-game |
| `created`              | Informational; `lastModified` is sufficient   |
| `portrait` (all of it) | Addon does not render images                  |
| `background.kinkList`  | Not displayed in the addon                    |
| `affiliations`         | Social data, unused by addon                  |
| `balance`              | Website-only economy field (if it exists)     |

### 2.5 Fields to Keep

For clarity, the exported object should contain exactly:

```jsonc
{
  "id":              "uuid",
  "characterName":   "string",
  "lastModified":    "ISO-8601 string",
  "schemaVersion":   2,              // see §3

  "experience":      { "total", "unspent" },
  "corruption":      { "permanent", "temporary" },

  "attributes": {
    "primary":          { "accurate", "cunning", "discreet", "appealing",
                          "quick", "resolute", "vigilant", "strong" },
    "primaryEffective": { /* same eight keys — server-derived, may exceed 15 */ },
    "secondary":        { "toughness": { "max", "current" },
                          "painThreshold", "corruptionThreshold", "defense",
                          "armor", "corruptionMax" }
  },

  "traits":          [],
  "rituals":         [],
  "talents":         [],
  "effects":         [],
  "traditions":      [],

  // Server-derived roll pointers (ADR-015 §3c/§3d) — which primary
  // spell-power and initiative rolls use. Consume verbatim.
  "magicAttribute":      "resolute",
  "initiativeAttribute": "quick",

  "combat": {
    // ADR-014; Slot = { weaponIndex, ...derived }; own slot (index 2) required (own quality).
    // Each occupied slot carries engine-derived fields: attackAttribute,
    // baseDamage, bonusDamage, qualities, flags.
    "carried": [Slot|null, Slot|null, Slot]
  },

  // Derived collections — pure recalc output, consume verbatim (do not re-dedupe):
  "flags":           [],             // character-level flag set
  "specialAttacks":  [],             // Action[] with trigger === "manual"
  "reactions":       [],             // Action[] with other triggers

  "equipment": {
    "money", "weapons", "ammunition",
    "armor": { "body", "plug" },     // pieces may carry qualitiesEffective (server overlay; fall back to qualities)
    "runes",
    "assassin", "tools",
    "inventory": { "carried", "home" },
    "artifacts"
  },

  "background": {
    "race", "shadow", "age", "profession",
    "journal": { "open", "done", "rumours" },
    "notes"
  },

  "location":        "string"
}
```

Everything marked derived above (`primaryEffective`, `secondary`, the
per-slot fields, `magicAttribute` / `initiativeAttribute`, `flags`,
`specialAttacks`, `reactions`) is recalculated by the website's engine on
every save. The addon **consumes these outputs verbatim** — it does not
run effect pipelines or recompute derived stats (see §8). Weapon swapping
during play is addon-side and not persisted per-swap; declarative action
fields (`damageBonus`, `ignoresArmor`, `inflicts`, `isFree`, `appliesTo`)
are resolved by the addon against the live carried weapon at play time
(data-contracts §1.1, ES §actions-declarative). There is no
`combat.active` field — the 3-slot `carried` tuple is the whole model.

---

## 3. Schema Versioning

The website must include a `schemaVersion` field (integer) in every exported character. The addon uses it to detect format changes and run migrations.

- Current version: **2** (the server stamps 2 on every character).
- When the character schema changes in a way that affects the addon, bump this number **and** coordinate with the addon repo so a matching migration is added to `Core/CharSheet.lua`.

> **Bump discipline is suspended** while the website is the only consumer
> of character data (sibling development paused). Schema changes before
> production land without a version bump; the number stays at 2 until
> sibling consumption begins, at which point the coordinate-and-bump rule
> above takes effect.

The `schemaVersion` is **not** the same as the website's internal data version or the API version. It tracks the shape of the data the addon expects.

---

## 4. Paste-Import Wire Format

The export string the player copies is:

```
Base64( Serialize( characterTable ) )
```

### 4.1 Serialization Format

The addon deserializes using its own `Util/Serialize.lua`. The website must produce a byte-compatible format. The algorithm (designed for Lua tables) is:

```
Value encoding:
  nil       → "^Z"
  true      → "^T"
  false     → "^F"
  number    → "^N" .. tostring(number)
  string    → "^S" .. escaped_string
  table     → "^{" .. (key_encoding .. value_encoding)* .. "^}"

String escaping:
  "^" → "^^"
  Control bytes (0x00–0x1F) → "^" .. chr(byte + 64)

Key encoding:
  Same as value encoding (string keys and integer keys are both supported).
```

> **Alternative (simpler for the website):** If implementing the Lua
> serializer in JavaScript is burdensome, the website may produce a
> **JSON string** instead. In that case the export becomes
> `Base64( JSON.stringify( characterTable ) )` and the addon will detect the
> leading `{` after Base64-decoding and use a minimal JSON parser in
> `Import/PasteImport.lua`. Coordinate with the addon repo if choosing this
> path — the addon defaults to expecting Lua-serialized data.

### 4.2 Base64

Standard Base64 (RFC 4648, `A-Za-z0-9+/`, `=` padding). No URL-safe variant, no line breaks.

### 4.3 Reference Implementation

The addon's serializer lives at
[`nagara-addon/Nagara/Util/Serialize.lua`](https://github.com/skiotha/nagara-addon/blob/main/Nagara/Util/Serialize.lua) (once implemented). A JavaScript port should pass the same round-trip test vectors found in [`nagara-addon/test/test_serialize.lua`](https://github.com/skiotha/nagara-addon/blob/main/test/test_serialize.lua).

---

## 5. Paste-Export / Reverse Import

Players can export their **addon-side** character data back to the website via a manually copied string. The format is identical to §4:

```
Base64( Serialize( characterTable ) )
```

The website needs a page or form to accept this string:

### 5.1 Endpoint: Update from Addon

```
POST /api/v1/characters/:id/import/addon
Content-Type: text/plain
Authorization: (owner or DM)
Body: <base64-encoded serialized character>
```

**Behavior:**

1. Base64-decode and deserialize the body.
2. Validate the resulting object against the character schema.
3. Compare `lastModified` with the stored version.
   - If the incoming `lastModified` is **older or equal** → reject with
     `409 Conflict` and a message like "Website version is newer."
   - If **newer** → merge into the stored character, update `lastModified`.
4. Return `200 OK` with the updated character, or the appropriate error.

### 5.2 UI

A simple page with a text area ("Paste your addon export string here") and a submit button is sufficient. Linked from the character's detail page.

---

## 6. DM Sync Endpoint

After a game session, the DM runs `scripts/sync_upload.py` from the addon repo. The script reads the DM's WoW SavedVariables, extracts cached character data, and POSTs changes to the website.

### 6.1 Endpoint

```
POST /api/v1/characters/:id/sync
Authorization: Bearer <dm-token>
Content-Type: application/json
Body: { <character data matching §2.5 schema> }
```

### 6.2 Behavior

1. Validate the DM token (existing `x-dm-id` middleware or Bearer token —
   use whichever pattern the website already has).
2. Compare incoming `lastModified` against the stored version.
   - **Incoming is newer** → merge and save. Return `200 OK`.
   - **Incoming is older or equal** → return `409 Conflict`.
     The script logs a warning and skips.
   - **Character not found** → return `404 Not Found`. The script logs and
     skips (characters are created on the website, not by the addon).
3. `401 Unauthorized` if the token is invalid or missing.

### 6.3 DM Token

- A long-lived secret token, not a player session cookie.
- Stored in the DM's local `scripts/.env` file (`.gitignore`d, never committed).
- The website issues it manually (no self-service flow needed — there is one DM).

### 6.4 Sync Script Contract

The script sends one request per changed character. It does **not** batch. Expected request rate: 1–15 characters per session, infrequent (weekly or biweekly). No rate-limiting concerns.

---

## 7. Abilities / Static Data Endpoint

The addon ships a baked static database (generated at build time from JSON). The source JSON currently lives in the addon repo (`temp/abilities.en.json` and similar). If the website becomes the canonical source for abilities, spells, rituals, etc., the build script will need to either fetch them from the API or read them directly from the website's `reference/` directory:

### 7.1 Endpoints

```
GET /api/v1/traits?locale=en    # merged abilities + spells; each entry stamped { source: "ability" | "spell" }
GET /api/v1/talents?locale=en   # merged boons + sins;       each entry stamped { source: "boon" | "sin" }
GET /api/v1/rituals?locale=en
GET /api/v1/weapons?locale=en
GET /api/v1/armor?locale=en
GET /api/v1/qualities?locale=en  # quality registry (ADR-016): id-keyed effects shared by weapons + armor
GET /api/v1/statuses?locale=en   # localized status descriptions (display-only; engine treats statuses as opaque EffectFlag tokens)
```

Locale is resolved as: `?locale=` query → first matching primary subtag in `Accept-Language` → `en` default. Unknown locales return `400`.

These return the full dataset for each category as JSON arrays. The addon's `scripts/build.py` fetches them at build time and converts to Lua table literals. The addon **never** calls these at runtime.

> The split files (`reference/abilities.en.json`, `reference/spells.en.json`, …) are
> still on disk if the addon prefers reading them directly instead of via the API.
> `items` and `rules` endpoints are not yet implemented.

---

## 8. Effect Object Schema

Effects ride the wire fully typed; the canonical shape is
[data-contracts §1.1](data-contracts.md) (locked by ADR-015). An effect
object looks like:

```jsonc
{
  "id":          "string",           // unique effect identifier
  "source":      "ability" | "spell" | "item" | "ritual" | "rule",
  "name":        "string",
  "description": "string",
  "target":      { "kind": "..." },  // 8-kind discriminated union (data-contracts §1.1)
  "modifier":    { "type": "..." },  // setBase | addFlat | multiply | cap | remove
  "duration":    null                // engine-ignored; lifecycle is addon-side
}
```

There is **no `priority` field** and no priority-ordered processing: the
website's engine resolves the full pipeline on every save, and the
character the addon receives already carries the outcomes as derived
fields (§2.5). The addon does **not** run an effect pipeline —
`Core/Effects.lua` should treat `effects[]` as documentary data (display,
tooltips) plus the declarative fields it resolves at play time
(`appliesTo` predicates against the live carried weapon, action fields
per data-contracts §1.1). Dotted-path `target` strings and the legacy
`add` / `mul` / `set` modifier verbs no longer exist on the wire.

---

## 9. Trait Object Schema

Learned entries on the character use a source discriminator, not a
`category` field, and split tier/level by family
(data-contracts §1.2):

```jsonc
// traits[] — abilities and spells (tier model)
{ "id": "string", "tier": "novice" | "adept" | "master", "source": "ability" | "spell" }

// talents[] — sins and boons (level model)
{ "id": "string", "level": 1, "source": "sin" | "boon" }

// rituals[] (level model, no source)
{ "id": "string", "level": 1 }
```

`name` / `description` are **not** stored on the character — the addon
resolves them from its baked static database by `id` (§7).

---

## 10. Summary of Required Work

> **On hold** — all remaining items below are deferred until the website
> roadmap completes and sibling development resumes.

| Priority | Item                                    | Type           | Section | Status |
| -------- | --------------------------------------- | -------------- | ------- | ------ |
| **P0**   | `GET .../export/addon` endpoint         | New endpoint   | §2      | deferred |
| **P0**   | Serializer (Lua-compat or JSON)         | New utility    | §4      | deferred |
| **P0**   | Base64 encoder                          | New utility    | §4.2    | deferred |
| **P1**   | `POST .../import/addon` (paste-export)  | New endpoint   | §5      | deferred |
| **P1**   | "Update from Addon" UI page             | New page       | §5.2    | deferred |
| **P1**   | `POST .../sync` (DM sync)               | New endpoint   | §6      | deferred |
| **P1**   | DM token issuance                       | Config / admin | §6.3    | deferred |
| **P2**   | Static data endpoints (spells, etc.)    | New endpoints  | §7      | ✅ shipped |
| **P2**   | `schemaVersion` field in character data | Schema change  | §3      | ✅ shipped (stamps 2) |

P0 = needed before the addon's paste-import implementation.
P1 = needed before the addon's website-sync feature.
P2 = nice-to-have, can use static JSON files in the addon repo as interim.
