# Nagara Character Builder — Architecture

> Living document. Updated as the design evolves.

## 1. Overview

The Nagara Character Builder is a web application for creating and managing RPG characters in the Nagara tabletop system. It serves as the **canonical long-term store** for character data — the single source of truth consumed by two sibling projects:

- **addon** — World of Warcraft addon (Lua). Session-time consumer and editor.
- **malizia** — Discord bot (TypeScript). Rules lookup, dice rolling, character references.

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Nagara Website (this project)                 │
│                                                                      │
│   ┌─────────────┐  ┌──────────┐  ┌──────────────────────────┐        │
│   │   Router    │  │ Handlers │  │  Schema (data + UI meta) │        │
│   │  (HTTP)     │──│(JSON API)│  │  → GET /api/v1/schema    │        │
│   └──────┬──────┘  └────┬─────┘  └──────────────────────────┘        │
│          │              │                                            │
│   ┌──────┴──────────────┴─────────────────────────────────────┐      │
│   │                    Middleware                             │      │
│   │            (auth · permissions · body parsing)            │      │
│   └──────────────────────┬────────────────────────────────────┘      │
│                          │                                           │
│   ┌──────────────────────┴────────────────────────────────────┐      │
│   │                    Core Services                          │      │
│   │                                                           │      │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │      │
│   │  │  Schema  │  │  Rules   │  │ Storage  │  │   SSE    │   │      │
│   │  │ & Valid. │  │  Engine  │  │ (JSON fs)│  │ Broadcast│   │      │
│   │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │      │
│   └───────────────────────────────────────────────────────────┘      │
│                                                                      │
│   ┌───────────────────────────────────────────────────────────┐      │
│   │                    Data Layer                             │      │
│   │   data/characters/*.json   data/index.json                │      │
│   │   data/uploads/portraits/  data/backups/                  │      │
│   └───────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────┘

         ▲ paste-import       sync script ▲       ▲ API calls
         │ string             (DM only)   │       │
┌────────┴──────────┐              ┌──────┴───────┴──────────┐
│   WoW Addon       │              │   Discord Bot (malizia) │
│  (session editor) │              │  (lookup, dice, refs)   │
└───────────────────┘              └─────────────────────────┘
```

## 2. Stack

| Layer     | Technology                         | Notes                                    |
| --------- | ---------------------------------- | ---------------------------------------- |
| Runtime   | Node.js 24+                        | Native TypeScript via strip-types        |
| Server    | Raw `node:http` / `node:https`     | Zero external dependencies (see ADR-001) |
| Client    | Vanilla JavaScript ES modules      | No build step, import maps               |
| Storage   | File-based JSON on disk            | In-memory index, file-per-character      |
| Real-time | Server-Sent Events (SSE)           | Per-character broadcast channels         |
| Types     | TypeScript (`.mts`, `noEmit`)      | Type-checked, not compiled               |
| Tests     | `node:test` + `node:assert/strict` | Mirrors malizia test conventions         |

## 3. Layer Responsibilities

### 3.1 Router

Entry point for all HTTP requests. Responsibilities:

- Route API requests (`/api/v1/...`) to handlers
- Serve static client files from `public/`
- Serve uploaded portraits from `data/uploads/`
- CORS headers (see ADR-007)
- SPA fallback (serve `index.html` for unmatched client routes)

Currently implemented as a single function with an if/else chain in `app.mts`.
Planned migration to a declarative router pattern (see roadmap Phase 7).

### 3.2 Handlers

One handler per API action. Each receives `(req, res, ...)` and is responsible for parsing the request body, calling services, and writing the response.

| Handler                 | Route                             | Method |
| ----------------------- | --------------------------------- | ------ |
| `handleGetCharacters`   | `/api/v1/characters`              | GET    |
| `handleGetCharacter`    | `/api/v1/characters/:id`          | GET    |
| `handleCreateCharacter` | `/api/v1/characters`              | POST   |
| `handleUpdateCharacter` | `/api/v1/characters/:id`          | PATCH  |
| _(inline in router)_    | `/api/v1/characters/:id`          | DELETE |
| `handleUploadPortrait`  | `/api/v1/characters/:id/portrait` | POST   |
| `handleCharacterStream` | `/api/v1/characters/:id/stream`   | GET    |
| `handleGetAbilities`    | `/api/v1/abilities`               | GET    |
| `handleValidateDM`      | `/api/v1/validate-dm`             | POST   |
| `handleGetSchema`       | `/api/v1/schema`                  | GET    |

> **Note:** The server currently also mounts view endpoints under
> `/api/v1/view/` that return server-rendered HTML fragments. These are
> being replaced by schema-driven client rendering (see [ADR-009](decisions/009-schema-driven-rendering.md)).
> Once the migration is complete, the server becomes a pure JSON API.

### 3.3 Middleware

- **Auth:** Extracts `x-player-id` and `x-dm-id` from headers. DM token validated against env var (see ADR-003).
- **Character permissions:** Loads character, determines role (`dm` / `owner` / `public`), attaches to `req`.
- **Middleware chain:** Custom `createMiddlewareChain()` composes middleware functions in sequence with a `next()` pattern.

### 3.4 Schema & Validation

The character schema (`CHARACTER_SCHEMA`) is a single object literal that defines every field's type, constraints, permissions, defaults, and UI metadata. Used for:

- Default character generation
- Field-level validation (type, range, pattern)
- Permission checks (who can read/write which fields)
- Cross-field rule validation (attribute budget, derived stat consistency)
- Identifying server-controlled vs user-editable fields
- **Client-side form rendering** — UI metadata (section, label, order, editability per role) drives a generic form renderer on the client (see [ADR-009](decisions/009-schema-driven-rendering.md))

The schema is served to the client via `GET /api/v1/schema` (cached, ETag-friendly) and used by both server validation and client rendering — single source of truth.

### 3.5 Rules Engine

Calculates derived character stats from primary attributes and active effects.

- **Attribute formulas** (`attributes.mts`): secondary stats derived from primaries (toughness from strong, defense from quick, etc.)
- **Effect applicator** (`applicator.mts`): applies modifier pipeline to character fields
- **Derived recalculation** (`derived.mts`): orchestrates the full recalculation pass, called on every character update before saving

### 3.6 Storage

File-based JSON persistence with an in-memory index.

- Each character is a separate `.json` file in `data/characters/`
- An `index.json` maintains lookup maps: `byId`, `byBackupCode`, `byPlayer`, `all`
- Index is loaded into memory at startup, kept in sync on writes
- Backup system: snapshot-based, stored in `data/backups/`

### 3.7 SSE (Server-Sent Events)

Per-character broadcast channels for real-time updates during gameplay.

- Clients connect to `/api/v1/characters/:id/stream`
- On character update (PATCH), the saved character data is broadcast to all connected clients for that character
- Designed for DM + player pairs working on the same character during a session
- Keep-alive pings to maintain connections

### 3.8 Client SPA

Vanilla JavaScript SPA served as static files.

- **State management:** In-memory state object with subscriber pattern for reactive field-level updates
- **Schema-driven rendering:** Character and creation views are rendered client-side from `(schema, data, role)` — the schema (fetched once, cached) defines field layout, sections, labels, and editability. Dashboard and landing views use dedicated render functions (see [ADR-009](decisions/009-schema-driven-rendering.md))
- **Behaviors:** Declarative behavior system (editable, selectable, copyable, etc.) attached to elements via data attributes
- **SSE client:** Connects to character stream, updates local state on events — same rendering pipeline as initial load
- **Import maps:** Module aliases (`@state`, `@api`, `@router`) in the HTML

## 4. Data Flow

### 4.1 Character Creation

```
Client (browser)
  │ POST /api/v1/characters  { characterName, attributes, ... }
  ▼
handleCreateCharacter
  │ parse body → filter server-controlled fields → validate
  ▼
createCharacter (service)
  │ generate UUID + backup code → merge with defaults
  ▼
storage.saveCharacter
  │ write character.json → update index.json
  ▼
Response: 201 { character }
```

### 4.2 Character Update (with SSE broadcast)

```
Client (browser)
  │ PATCH /api/v1/characters/:id  { updates: [...] }
  ▼
middleware: withCharacterPermissions
  │ load character → determine role
  ▼
handleUpdateCharacter
  │ validate each update against schema + role
  │ apply valid updates → recalculate derived fields
  ▼
storage.updateCharacter
  │ deep merge → write file → update index if metadata changed
  ▼
sse.broadcastToCharacter
  │ push updated character to all connected SSE clients
  ▼
Response: 200 { character }
```

### 4.3 Schema-Driven Rendering (target, see [ADR-009](decisions/009-schema-driven-rendering.md))

```
Client (browser)
  │ GET /api/v1/schema          (once, cached)
  │ GET /api/v1/characters/:id  (JSON data)
  ▼
schema + data + role
  │ → form renderer(schema, data, role)
  ▼
DOM with data-path, data-behavior attributes
  │ → enhanceElement() attaches behaviors
  │ → subscribeField(path) binds SSE updates
  ▼
SSE character-updated
  │ → setCurrentCharacter(newData)
  │ → field subscribers fire
  │ → updateFieldValue() patches DOM
  ▼
Same pipeline for initial render and real-time updates
```

> **Legacy flow (being removed):** Server-rendered HTML fragments via
> `GET /api/v1/view/*` endpoints, injected into the DOM by the client.
> See [ADR-004](decisions/004-hybrid-spa-server-views.md) (superseded).

## 5. Cross-Project Data Exchange

See [data-contracts.md](data-contracts.md) for the full schema specification.

| Direction             | Mechanism                      | Format                        |
| --------------------- | ------------------------------ | ----------------------------- |
| Website → Addon       | Paste-import string            | Base64(JSON) or Base64(Lua)   |
| Addon → Website       | DM sync script (POST)          | JSON over HTTPS               |
| Addon → Website       | Paste-export (fallback)        | Base64 string → paste into UI |
| Website → Discord Bot | Filesystem reads (same VPS)    | JSON (index + character files)|
| Discord Bot → Website | `PATCH` REST API               | JSON                          |

## 6. Deployment

- **Domain:** `nagara.team` / `www.nagara.team`
- **Development:** `node src/server.mts` on localhost:3000 (HTTP)
- **Production:** HTTPS on a VPS, bound to 0.0.0.0:443. HTTP (port 80) redirects to HTTPS
- **SSL:** Certs stored in `../secrets/ssl/` (outside all repos, never committed)
  - `nagara.team.key` — private key
  - `nagara.team.crt` — certificate
  - Referenced via `SSL_KEY` / `SSL_CERT` env vars
- **Data persistence:** `data/` directory on the VPS filesystem (outside source tree, backed up)
- **Process management:** `watcher.mts` for auto-restart on crash; systemd or similar in production
