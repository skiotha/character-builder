# Nagara Website — Addon Integration Specification

> Requirements the WoW addon places on the website.
> This document lives in the website repo but is authored by the addon side.
> Addon-side contracts and architecture:
> [`../addon/docs/data-contracts.md`](../../addon/docs/data-contracts.md),
> [`../addon/docs/architecture.md`](../../addon/docs/architecture.md).

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

The UI will likely consume this through a copyable text box or a "copy to
clipboard" button, rather than requiring users to hit the raw API.

### 2.3 Fields to Include

Every field in the character schema **except** the ones listed below.
This roughly corresponds to the existing `owner`-visible permission set,
minus server-internal metadata.

### 2.4 Fields to Exclude

These must be **stripped** before serialization. They either contain
server-internal data or information the addon cannot use.

| Field                  | Reason                                        |
| ---------------------- | --------------------------------------------- |
| `playerId`             | Website-internal identity, unused in-game     |
| `player`               | Website display name; addon uses WoW names    |
| `backupCode`           | Sensitive recovery code, not relevant in-game |
| `created`              | Informational; `lastModified` is sufficient   |
| `portrait` (all of it) | Addon does not render images                  |
| `background.kinkList`  | Not displayed in the addon                    |
| `assets`               | Duplicate of tradition info / unused by addon |
| `balance`              | Website-only economy field (if it exists)     |

### 2.5 Fields to Keep

For clarity, the exported object should contain exactly:

```jsonc
{
  "id":              "uuid",
  "characterName":   "string",
  "lastModified":    "ISO-8601 string",
  "schemaVersion":   1,              // see §3

  "experience":      { "total", "unspent" },
  "corruption":      { "permanent", "temporary" },

  "attributes": {
    "primary":   { "accurate", "cunning", "discreet", "alluring",
                   "quick", "resolute", "vigilant", "strong" },
    "secondary": { "toughness": { "max", "current" },
                   "painThreshold", "corruptionThreshold", "defense" }
  },

  "traits":          [],
  "effects":         [],
  "tradition":       "string",

  "equipment": {
    "money", "weapons", "ammunition",
    "armor": { "body", "plug" },
    "runes",
    "professional": { "assassin", "utility" },
    "inventory": { "self", "home" },
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

---

## 3. Schema Versioning

The website must include a `schemaVersion` field (integer) in every exported
character. The addon uses it to detect format changes and run migrations.

- Current version: **1**.
- When the character schema changes in a way that affects the addon, bump this
  number **and** coordinate with the addon repo so a matching migration is
  added to `Core/CharSheet.lua`.

The `schemaVersion` is **not** the same as the website's internal data version
or the API version. It tracks the shape of the data the addon expects.

---

## 4. Paste-Import Wire Format

The export string the player copies is:

```
Base64( Serialize( characterTable ) )
```

### 4.1 Serialization Format

The addon deserializes using its own `Util/Serialize.lua`. The website must
produce a byte-compatible format. The algorithm (designed for Lua tables) is:

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

Standard Base64 (RFC 4648, `A-Za-z0-9+/`, `=` padding). No URL-safe variant,
no line breaks.

### 4.3 Reference Implementation

The addon's serializer lives at
[`../addon/Nagara/Util/Serialize.lua`](../../addon/Nagara/Util/Serialize.lua)
(once implemented). A JavaScript port should pass the same round-trip test
vectors found in
[`../addon/test/test_serialize.lua`](../../addon/test/test_serialize.lua).

---

## 5. Paste-Export / Reverse Import

Players can export their **addon-side** character data back to the website via
a manually copied string. The format is identical to §4:

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

A simple page with a text area ("Paste your addon export string here") and a
submit button is sufficient. Linked from the character's detail page.

---

## 6. DM Sync Endpoint

After a game session, the DM runs `scripts/sync_upload.py` from the addon
repo. The script reads the DM's WoW SavedVariables, extracts cached character
data, and POSTs changes to the website.

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

The script sends one request per changed character. It does **not** batch.
Expected request rate: 1–15 characters per session, infrequent (weekly or
biweekly). No rate-limiting concerns.

---

## 7. Abilities / Static Data Endpoint

The addon ships a baked static database (generated at build time from JSON).
The source JSON currently lives in the addon repo (`temp/abilities.en.json`
and similar). If the website becomes the canonical source for abilities,
spells, rituals, etc., the build script will need to fetch them:

### 7.1 Endpoint (optional, low priority)

```
GET /api/v1/abilities
GET /api/v1/spells
GET /api/v1/rituals
GET /api/v1/talents
GET /api/v1/items
GET /api/v1/rules
```

These return the full dataset for each category as JSON arrays. The addon's
`scripts/build.py` fetches them at build time and converts to Lua table
literals. The addon **never** calls these at runtime.

> `/api/v1/abilities` already exists. The others can be added as the data is
> populated on the website.

---

## 8. Effect Object Schema

Effects are the most structurally complex piece of shared data. Both sides
must agree on the shape. An effect object looks like:

```jsonc
{
  "id":          "string",           // unique effect identifier
  "source":      "ability" | "spell" | "item" | "ritual" | "rule",
  "name":        "string",
  "description": "string",
  "target":      "string",           // dotted path, e.g. "attributes.secondary.defense"
  "modifier": {
    "type":  "setBase" | "addFlat" | "multiply" | "cap",
    "value": "string | number"       // attribute name or numeric amount
  },
  "priority":    "number",           // lower = applied first
  "duration":    "number | null"     // null = permanent
}
```

The addon's `Core/Effects.lua` processes these in priority order using the
pipeline: `setBase → addFlat → multiply → cap`. The website should produce
effects that follow this structure and ordering convention.

---

## 9. Trait Object Schema

```jsonc
{
  "id": "string",
  "name": "string",
  "category": "string", // e.g. "ability", "spell", "talent", "ritual"
  "tier": "string | null", // "novice", "adept", "master", or null
  "description": "string",
}
```

---

## 10. Summary of Required Work

| Priority | Item                                    | Type           | Section |
| -------- | --------------------------------------- | -------------- | ------- |
| **P0**   | `GET .../export/addon` endpoint         | New endpoint   | §2      |
| **P0**   | Serializer (Lua-compat or JSON)         | New utility    | §4      |
| **P0**   | Base64 encoder                          | New utility    | §4.2    |
| **P1**   | `POST .../import/addon` (paste-export)  | New endpoint   | §5      |
| **P1**   | "Update from Addon" UI page             | New page       | §5.2    |
| **P1**   | `POST .../sync` (DM sync)               | New endpoint   | §6      |
| **P1**   | DM token issuance                       | Config / admin | §6.3    |
| **P2**   | Static data endpoints (spells, etc.)    | New endpoints  | §7      |
| **P2**   | `schemaVersion` field in character data | Schema change  | §3      |

P0 = needed before addon Phase 2 (paste-import implementation).
P1 = needed before addon Phase 11 (website sync).
P2 = nice-to-have, can use static JSON files in the addon repo as interim.
