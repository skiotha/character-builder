# Nagara Website — Bot Integration Specification

> Requirements the Discord bot places on the website.
> This document lives in the website repo but is authored by the bot side.
> Bot-side contracts and architecture:
> [malizia/docs/data-contracts.md](https://github.com/skiotha/malizia/blob/main/docs/data-contracts.md),
> [malizia/docs/architecture.md](https://github.com/skiotha/malizia/blob/main/docs/architecture.md).

---

## 1. Overview

Three Nagara subsystems exchange data:

```
  Website  ◄── fs + HTTP ──►  Discord Bot (malizia)  ◄────►  Discord Users
     ▲
     │
  WoW Addon (out of scope here, see addon-integration.md)
```

The website is the **canonical long-term store** for character data. The Discord bot is a **real-time consumer and limited editor** of that data, providing character references, dice rolling, and gameplay management directly in Discord chat.

**Key architectural fact:** The bot and the website run on the **same VPS** as two separate Node.js processes. The bot reads character data directly from the website's data directory — no API round-trips for reads. Write operations go through the website's REST API to preserve validation, derived-stat recalculation, and SSE broadcasts.

| Direction        | Mechanism                      | Purpose                  |
| ---------------- | ------------------------------ | ------------------------ |
| Website → Bot    | Filesystem reads (local)       | Character lookup, search |
| Bot → Website    | `PATCH /api/v1/characters/:id` | Character updates        |

---

## 2. File Access

The bot reads the following files from the website's `data/` directory:

| File                         | Purpose                              |
| ---------------------------- | ------------------------------------ |
| `data/index.json`            | Character search by name, ID lookup  |
| `data/characters/<id>.json`  | Full character data for display      |

The bot **never writes** to these files. All mutations go through the API.

### 2.1 Stability Requirement

The bot depends on the structure of `index.json` and the character JSON schema. If either changes shape, the bot must be updated. Specifically:

- `index.json` must contain a `byId` map where values include at minimum `characterName` (for name search).
- Character JSON files must follow the schema defined in [data-contracts.md §1](data-contracts.md).

### 2.2 Filesystem Safety

Node.js `writeFile` on Linux (write-to-temp + rename) is atomic, so the bot will not encounter partial writes when reading files the website is updating. No locking or coordination mechanism is needed.

---

## 3. Schema Extension: Discord Identity

**New field.** Does not exist yet.

The bot needs to map Discord user IDs to characters so that players can update their own data and DMs can target specific players.

### 3.1 Proposed Change

Add a `discordId` field to the character schema:

```jsonc
{
  // ... existing fields ...
  "discordId": "123456789012345678"   // Discord user ID (snowflake string)
}
```

| Property        | Value                                            |
| --------------- | ------------------------------------------------ |
| Type            | `string` (Discord snowflake, 17–20 digits)       |
| Required        | No (optional, characters can exist without one)  |
| Default         | `""` (empty string)                              |
| Settable by     | Owner (via website UI), DM                       |
| Unique          | One Discord ID can map to multiple characters    |
| Indexed         | Should be included in `index.json` `byId` values |

### 3.2 How the Bot Uses It

1. Discord user sends a command (e.g. `/update toughness 8`).
2. Bot reads `interaction.member.user.id` → `"123456789012345678"`.
3. Bot scans `index.json` `byId` entries for matching `discordId`.
4. Bot resolves the character UUID.
5. For writes: bot reads `playerId` from the character file, sends `PATCH` with `x-player-id: <playerId>` header.

### 3.3 Linking UX

One possible flow for players to link their Discord account:

1. Player uses a `/link` bot command in Discord.
2. Bot responds with a one-time URL to the website (e.g. `/link?token=<short-lived-token>&discordId=<id>`).
3. Player opens the URL in their browser (where `localStorage` already contains their `x-player-id`).
4. Website writes the `discordId` to the player's character(s).

Alternative: a simple form on the character page where the owner pastes their Discord user ID. Less polished, but simpler.

The mechanism is the website's decision. The bot only cares that `discordId` is present and correct in the character data.

### 3.4 Timing

This field is needed before the bot's Phase 2 (Identity & Write Operations). Phase 1 (read-only character lookup) works without it.

The website's roadmap has a Schema Review gate in Phase 2 and a Sibling Project Integration phase (Phase 6). Either is a natural place for this change.

---

## 4. API Usage for Writes

The bot uses the website's existing `PATCH` endpoint — no new endpoints are required.

### 4.1 Endpoint

```
PATCH /api/v1/characters/:id
Content-Type: application/json
```

### 4.2 Auth Headers

| Scenario            | Header         | Value                    |
| ------------------- | -------------- | ------------------------ |
| Player's own data   | `x-player-id`  | Character's `playerId`   |
| DM operations       | `x-dm-id`      | Shared `NAGARA_DM_TOKEN` |

The bot knows the `playerId` because it reads the character file from disk. The DM token is shared between the website and bot via the same environment variable (`NAGARA_DM_TOKEN`) on the same VPS.

### 4.3 Write Scenarios

| Bot Command      | Fields Updated                           | Auth         |
| ---------------- | -------------------------------------- - | ------------ |
| `/update`        | `toughness.current`, `corruption.temporary`, `equipment`, `journal`, `location` | `x-player-id` |
| `/dm-xp`         | `experience.total`, `experience.unspent` | `x-dm-id`    |
| `/dm-corruption` | `corruption.permanent`                   | `x-dm-id`    |
| `/dm-effect`     | `effects`                                | `x-dm-id`    |

### 4.4 Payload Format

Standard website update format:

```jsonc
{
  "updates": [
    { "field": "attributes.secondary.toughness.current", "value": 8 }
  ]
}
```

---

## 5. Portrait Access

The bot embeds character portraits in Discord messages. It constructs URLs from the character's `portrait.path` field:

```
${WEBSITE_BASE_URL}/${portrait.path}
```

Discord fetches these URLs server-side when rendering embeds. Requirements:

- Portrait files must be served over HTTPS (Discord rejects HTTP image URLs in embeds).
- No CORS requirements — Discord's embed renderer is not a browser and does not send `Origin` headers.
- Portraits should be reasonably sized (Discord has a 25 MB file size limit for embed images, but smaller is better for load times).

---

## 6. Future Considerations

### 6.1 Separation

If the bot and website are ever deployed to separate machines, the bot would need API endpoints for reads. Candidates:

- `GET /api/v1/characters?name=<query>` — search by character name.
- The existing `GET /api/v1/characters/:id` already covers direct lookup.

This migration would only affect the bot's `src/lib/characters.mts` module — the rest of the bot is unaware of the data source.

### 6.2 Real-Time Updates During Sessions

When the bot runs RP sessions (Phase 4), it holds character data in memory. If the character is simultaneously edited on the website, the bot's state becomes stale. Two potential solutions:

- The bot re-reads the character file from disk before each roll (simple, low-cost for small data).
- The bot subscribes to the website's SSE stream for active session characters (complex, only needed if stale data causes gameplay issues).

The simpler approach (re-read from disk) is sufficient for now.
