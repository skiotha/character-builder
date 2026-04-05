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
- **ADR-010:** Effect resolution pipeline — explicit phases (`setBase` → formulas → `addFlat` → `multiply` → `cap` → flags), typed `Character` state, unified effect collection from all sources.
- **ADR-011:** Typed effect targets — discriminated union (`secondary | combat | weaponQuality | armorQuality | flag | check`) replacing dotted-path strings. Exhaustive switch/case handling.
- **ADR-012:** Standards-first HTML, CSS & Web Platform conventions. Semantic markup, `@layer`/`@scope`/native nesting, native widgets over custom JS, modern CSS and Web APIs preferred.

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

### Commands

```bash
npm run start:dev        # Dev server with file watcher
npm run typecheck        # TypeScript type-check (tsc --noEmit)
npm test                 # Run all tests: node --test test/**/*.test.mts
node --test test/foo.test.mts  # Run a single test file
```

### Testing

- Mirror the malizia project's test structure (`test/*.test.mts`)
- Use `node:test` (`describe`, `it`, `mock`) and `node:assert/strict`
- Mock external dependencies (filesystem, HTTP) using `node:test` mock utilities
- Tests run via: `node --test test/**/*.test.mts`
- `noUncheckedIndexedAccess` is enabled — array/index accesses return `T | undefined`. Use `!` non-null assertion on values you know exist (e.g. `mock.calls[0]!`) rather than adding unnecessary guards in test code.

### Static File Serving & URL Mapping

The server maps URLs to the filesystem as follows:

| URL prefix | Filesystem root | Notes |
| --- | --- | --- |
| `/assets/**` | `public/assets/` | Fonts, icons, images. Stripped of `/assets/` prefix. |
| `/uploads/portraits/**` | `data/uploads/portraits/` | Character portrait images. |
| `/**` (everything else) | `public/` | SPA client files (`.html`, `.mjs`, `.css`). Falls back to `index.html` for client-side routing. |

When rewriting or moving static file references, update both the HTML/CSS/JS `href`/`src` attributes **and** ensure the files exist at the corresponding filesystem path.

### Server

- No frameworks. Use `node:http` / `node:https` directly
- Production runs HTTPS (`nagara.team`). HTTP connections must redirect to HTTPS
- SSL certs are in `../secrets/ssl/` (outside repo, never committed)
- Request handlers receive `(req, res, ...)` and are responsible for the full response lifecycle
- Always check `res.headersSent` before writing response headers
- Use `crypto.timingSafeEqual()` for secret comparison (DM token)
- Enforce request body size limits on all endpoints accepting a body

### HTML & CSS (ADR-012)

- Semantic HTML first — use the most specific element (`<section>`, `<nav>`, `<dl>`, `<dialog>`, etc.) before reaching for `<div>` or `<span>`
- Native platform widgets over custom JS: `<dialog>`, `<details>/<summary>`, Popover API, customizable `<select>` (`appearance: base-select`)
- Field wrapper pattern: a containing element groups a `<label>` with its associated control
- CSS layers via `@layer` — separate concerns (reset, base, layout, theme, animation, responsive) in a fixed cascade order
- Use `@scope` for component-level isolation instead of BEM prefixes
- Use CSS native nesting — no flat repeated parent selectors
- Selectors: type-based + nesting by default. Classes for shared visuals (`.input`, `.stat`) or JS behavior hooks (`.editable`). IDs for unique styled entities
- No utility classes (`.flex`, `.mt-4`, etc.)
- Modern CSS features freely used: `oklch()`, anchor positioning, `@starting-style`, view transitions, container queries, `@property`, subgrid
- Interactive elements must be visually distinct (hover/focus states, color-coding, cursor) with clean microanimations
- All interactive elements must be keyboard-operable with visible focus styles
- Existing stylesheets predate ADR-012 and are not reference implementations — do not assume current patterns are correct
- Modern JS/Web APIs preferred when W3C/WHATWG-approved, even with intermediate browser support

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
| 6     | RPG Engine                       |
| 7     | Sibling project integration      |
| 8     | Polish & beyond MVP              |

## Sibling Projects

When making changes that affect the character data model or API, check:

- `docs/addon-integration.md` — what the addon expects
- `docs/bot-integration.md` — what the Discord bot expects
- `docs/data-contracts.md` — canonical schema and API contract
- [nagara-addon/docs/data-contracts.md](https://github.com/skiotha/nagara-addon/blob/main/docs/data-contracts.md) — addon-side contract
- [malizia/docs/data-contracts.md](https://github.com/skiotha/malizia/blob/main/docs/data-contracts.md) — bot-side contract
