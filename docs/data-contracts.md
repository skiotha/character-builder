# Nagara Character Builder — Data Contracts

> Canonical data shapes for the character builder and its consumers.
> Cross-project integration details live in
> [addon-integration.md](addon-integration.md) (addon-authored) and
> [bot-integration.md](bot-integration.md) (bot-authored).

---

## 1. Character Schema

The full character object as stored in `data/characters/<id>.json`.
This is the **source of truth** — all other formats derive from it.

```jsonc
{
  // ── Server-controlled metadata ──
  "id":            "uuid",              // generated, immutable
  "backupCode":    "Adjective-Noun-NNN",// generated, recovery credential
  "playerId":      "string",            // self-asserted player identity (see ADR-003)
  "player":        "string",            // display name
  "created":       "ISO-8601",          // set once on creation
  "lastModified":  "ISO-8601",          // updated on every save
  "schemaVersion": 1,                   // wire format version for cross-project compat

  // ── Identity ──
  "characterName": "string",            // 3–16 chars, letters/spaces/hyphens/apostrophes

  // ── Attributes ──
  "attributes": {
    "primary": {
      "accurate":  5,                   // 5–15, integer, budget total = 80
      "cunning":   5,
      "discreet":  5,
      "alluring":  5,
      "quick":     5,
      "resolute":  5,
      "vigilant":  5,
      "strong":    5
    },
    "secondary": {                      // all derived from primaries + effects
      "toughness": {
        "max":     10,                  // max(strong, 10)
        "current": 10                   // 0 ≤ current ≤ max
      },
      "painThreshold":       5,         // ceil(strong / 2)
      "corruptionThreshold": 5,         // ceil(resolute / 2)
      "defense":             5          // = quick (before modifiers)
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

  // ── Abilities & Effects ──
  "traits":    [],                      // array of trait objects
  "effects":   [],                      // array of effect objects (see §1.1)
  "tradition": "",                      // mystical tradition name

  // ── Equipment ──
  "equipment": {
    "money":      0,                    // non-negative number
    "weapons":    [],
    "ammunition": [],
    "armor": {
      "body": null,                     // object or null
      "plug": []
    },
    "runes":        [],
    "professional": {
      "assassin": [],
      "utility":  []
    },
    "inventory": {
      "self": [],
      "home": []
    },
    "artifacts": []
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

  // ── Assets ──
  "assets": [],                         // not exported to addon

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

```jsonc
{
  "id":          "string",
  "source":      "ability" | "spell" | "item" | "ritual" | "rule",
  "name":        "string",
  "description": "string",
  "target":      "string",             // dotted path, e.g. "rules.defense.base"
  "modifier": {
    "type":  "setBase" | "addFlat" | "multiply" | "cap",
    "value": "string | number"         // attribute name or numeric amount
  },
  "priority":    10,                   // lower = applied first
  "duration":    null                  // null = permanent, or ISO-8601 expiry
}
```

> **Known issue:** The current `applicator.mjs` uses `add`/`mul`/`set` instead
> of the canonical types above. This must be aligned — see roadmap Phase 4.

### 1.2 Trait Object

```jsonc
{
  "name":        "string",
  "type":        "string",            // ability tier or trait category
  "description": "string",
  "effects":     []                   // array of Effect objects (§1.1)
}
```

---

## 2. Permission Model

Each field in the schema has a `permissions` map:

```jsonc
{ "owner": true | false, "dm": true | false, "public": true | false }
```

- `true` — can read and write
- `false` — cannot read or write

Roles are determined per-request:
- **dm**: `x-dm-id` header matches the server's `NAGARA_DM_TOKEN`
- **owner**: `x-player-id` header matches the character's `playerId`
- **public**: everyone else

Fields marked `serverControlled: true` cannot be set by any client — they are generated and maintained by the server (id, backupCode, created, lastModified, portrait.path, portrait.status).

> **Known limitation:** The current `true`/`false` permission model conflates
> read and write access — a field is either fully accessible or fully hidden.
> There is no way to express "public can see but not edit" or per-field write
> restrictions independent of read. This model needs to be reworked before
> the schema-driven rendering migration (ADR-009), which introduces
> `editableBy` per field. See roadmap Phase 5.

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

> **Legacy:** The server currently exposes `/view/*` endpoints that return
> server-rendered HTML fragments (`/view/initial`, `/view/dashboard`,
> `/view/creation`, `/view/character/:id`). These will be removed once
> the schema-driven rendering migration is complete (roadmap Phase 3).

### 3.3 Other

| Method | Path                        | Auth | Response                 |
| ------ | --------------------------- | ---- | ------------------------ |
| `GET`  | `/abilities`                | none | abilities array (JSON)   |
| `POST` | `/validate-dm`              | DM   | validation result        |
| `POST` | `/recover`                  | none | character (by name+code) |

### 3.4 Planned Endpoints (not yet implemented)

| Method | Path                                | Auth   | Purpose                               | Source             |
| ------ | ----------------------------------- | ------ | ------------------------------------- | ------------------ |
| `GET`  | `/characters/:id/export/addon`      | owner/DM | Export character for WoW addon       | addon-integration §2 |
| `POST` | `/characters/:id/import/addon`      | owner/DM | Update character from addon export   | addon-integration §5 |
| `POST` | `/characters/:id/sync`              | DM     | DM sync script upload                 | addon-integration §6 |

### 3.5 Update Payload Format

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
