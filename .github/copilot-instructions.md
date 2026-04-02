# Nagara Character Builder — Copilot Instructions

## Project Overview

This is the **Nagara Character Builder**, a zero-dependency Node.js web application for creating and managing RPG characters in a custom tabletop system called Nagara. It is the canonical data store for character data and is consumed by two sibling projects:

- **addon** ([nagara-addon](https://github.com/skiotha/nagara-addon)) — World of Warcraft addon (Lua)
- **malizia** ([malizia](https://github.com/skiotha/malizia)) — Discord bot (TypeScript)

All three share the same character data model. The website is the source of truth.

## Stack & Conventions

- **Runtime:** Node.js 24+ (native TypeScript strip-types, no flag needed)
- **Language:** TypeScript (`.mts` files, `noEmit`, `strict`, `verbatimModuleSyntax`)
- **Server:** Raw `node:http` / `node:https` — zero npm runtime dependencies
- **Client:** Vanilla JavaScript SPA with native ES modules (no build step)
- **Storage:** File-based JSON persistence (`data/characters/*.json` + `data/index.json`)
- **Real-time:** Server-Sent Events (SSE) for live character updates
- **Tests:** `node:test` + `node:assert/strict` with `describe`/`it` blocks (same as malizia)
- **Types devDep:** `@types/node` only

## Architecture

See `docs/architecture.md` for the full system diagram.

Key layers:

- `src/types.mts` — app infrastructure types (request, middleware, validation, storage)
- `src/rpg-types.mts` — RPG domain types (Character, Effect, attributes, equipment)
- `src/lib/` — config, logger, auth, utilities
- `src/models/` — character schema, storage, validation, traversal
- `src/rules/` — RPG rules engine (derived stats, effects, attributes)
- `src/routes/` — API handlers and route wiring
- `src/middleware/` — auth and permission middleware
- `src/renderers/` + `src/templates/` — server-rendered HTML views (being removed per ADR-009)
- `src/sse/` — SSE broadcast channels
- `public/` — static client files (SPA, styles, assets)
- `data/` — runtime data (outside source tree, gitignored)

## Key Design Decisions

All decisions are documented as ADRs in `docs/decisions/`. Key ones:

- **ADR-001:** Zero external dependencies. No npm runtime deps.
- **ADR-002:** File-based JSON storage. One file per character.
- **ADR-003:** Self-asserted player identity via `x-player-id` header. Intentional for the small trusted userbase — not a security gap.
- **ADR-004:** ~~Hybrid SPA with server-rendered HTML fragments.~~ Superseded by ADR-009.
- **ADR-009:** Schema-driven client rendering. Schema with UI metadata served once; client renders forms from `(schema, data, role)`.
- **ADR-005:** SSE for real-time updates (not WebSockets).
- **ADR-007:** Strict CORS with explicit origin whitelist.
- **ADR-008:** TypeScript via Node.js strip-types (no build step).

## Coding Guidelines

### TypeScript

- Use `.mts` extension for all server files
- Use explicit type annotations on function parameters and return types
- Define interfaces for data shapes (prefer `interface` over `type` for objects)
- Use `import type` for type-only imports (`verbatimModuleSyntax` enforced)
- Use Node.js subpath imports (`#config`, `#logger`, `#models`, `#types`, etc.)
- Use `#models/*` wildcard for direct model sub-module access (e.g. `#models/storage`)
- Do not use `any` — use `unknown` and narrow

### Import Ordering

Imports are ordered by category, separated by blank lines:

1. **`node:`** — Node.js built-in modules
2. **Functions** — value imports (functions, namespace `* as` imports)
3. **Constants** — all-caps / configuration values
4. **`import type`** — type-only imports

If an import line contains both functions and constants, order it by the
highest-priority item (functions > constants).

### Testing

- Mirror the malizia project's test structure (`test/*.test.mts`)
- Use `node:test` (`describe`, `it`, `mock`) and `node:assert/strict`
- Mock external dependencies (filesystem, HTTP) using `node:test` mock utilities
- Tests run via: `node --test test/**/*.test.mts`

### Server

- No frameworks. Use `node:http` / `node:https` directly
- Production runs HTTPS (`nagara.team`). HTTP connections must redirect to HTTPS
- SSL certs are in `../secrets/ssl/` (outside repo, never committed)
- Request handlers receive `(req, res, ...)` and are responsible for the full response lifecycle
- Always check `res.headersSent` before writing response headers
- Use `crypto.timingSafeEqual()` for secret comparison (DM token)
- Enforce request body size limits on all endpoints accepting a body

### Data

- Character schema is defined in `src/models/character.mts`
- Server-controlled fields (id, backupCode, created, lastModified) must never be settable by clients
- Derived fields (secondary attributes) are recalculated on every save via the rules engine
- Effect modifier types: `setBase`, `addFlat`, `multiply`, `cap`

## File Naming

- Server source: `src/**/*.mts`
- Tests: `test/**/*.test.mts`
- Client JS: `public/**/*.mjs` (plain JS, no TypeScript)
- Config: `config/*.env`, `config/*.mts`
- Scripts: `scripts/*.mts`

## Roadmap

See `docs/roadmap.md` for the full phased work plan. Quick reference:

| Phase | Focus                            |
| ----- | -------------------------------- |
| 0     | Documentation & decisions (done) |
| 1     | Project restructure (done)       |
| 2     | TypeScript migration (done)      |
| 3     | Schema-driven rendering          |
| 4     | Testing                          |
| 5     | Bug fixes & hardening            |
| 6     | Sibling project integration      |
| 7     | Polish & beyond MVP              |

## Sibling Projects

When making changes that affect the character data model or API, check:

- `docs/addon-integration.md` — what the addon expects
- `docs/bot-integration.md` — what the Discord bot expects
- `docs/data-contracts.md` — canonical schema and API contract
- [nagara-addon/docs/data-contracts.md](https://github.com/skiotha/nagara-addon/blob/main/docs/data-contracts.md) — addon-side contract
- [malizia/docs/data-contracts.md](https://github.com/skiotha/malizia/blob/main/docs/data-contracts.md) — bot-side contract
