# Nagara Character Builder — Copilot Instructions

## Project Overview

This is the **Nagara Character Builder**, a zero-dependency Node.js web application for creating and managing RPG characters in a custom tabletop system called Nagara. It is the canonical data store for character data and is consumed by two sibling projects:

- **addon** ([nagara-addon](https://github.com/skiotha/nagara-addon)) — World of Warcraft addon (Lua)
- **malizia** ([malizia](https://github.com/skiotha/malizia)) — Discord bot (TypeScript)

All three share the same character data model. The website is the source of truth.

## Stack & Conventions

- **Runtime:** Node.js 26+ (native TypeScript strip-types, no flag needed)
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
- `src/lib/` — config, logger, auth, body parsing, CORS, rate limiter, utilities
- `src/models/` — domain layer (mutation gate per ADR-013), schema, storage, validation, traversal
- `src/rules/` — RPG rules engine (derived stats, effects, attributes)
- `src/routes/` — API handlers and route wiring (`createRoute(middlewares, handler)`)
- `src/middleware/` — auth and permission middleware
- `src/sse/` — SSE broadcast channels (per-subscriber sanitized)
- `public/` — static client files (SPA, styles, assets) — sole rendering layer per ADR-009
- `data/` — runtime data (outside source tree, gitignored)
- `reference/` — RPG reference catalogs (`abilities`, `spells`, `boons`, `sins`, `rituals`, `weapons`, `armor`, `qualities`, `statuses`), one file per `(topic, locale)`. Loaded via `src/models/reference.mts` and surfaced through `/api/v1/{traits,talents,rituals,weapons,armor,qualities,statuses}` (locale-aware, mtime-cached). **Not** served as static files. `qualities` is the engine-canonical registry from ADR-016 (single namespace shared by weapons and armor; engine throws on unknown ids). `statuses` is display-only metadata for sibling apps; the engine treats statuses as opaque `EffectFlag` tokens. A locale-drift lint test (`test/reference-locale-drift.test.mts`) keeps `{en,ru}` pairs aligned: same id set, same order, only `name`/`description`/`tags` may differ. **Authoring guide:** the wire shape of every catalog entry is specified in [`docs/reference-authoring.md`](../docs/reference-authoring.md).
- `rpg/` — RPG rules vault (Obsidian-authored Markdown, locale-structured). See [`rpg/README.md`](../rpg/README.md) for vault conventions, frontmatter, and the locale-parity policy.

## Key Design Decisions

All decisions are documented as ADRs in `docs/decisions/`. The index also lives
in [`docs/decisions/README.md`](../docs/decisions/README.md). Key ones:

- **ADR-001:** Zero external dependencies. No npm runtime deps.
- **ADR-002:** File-based JSON storage. One file per character.
- **ADR-003:** Self-asserted player identity via `x-player-id` header. Intentional for the small trusted userbase — not a security gap.
- **ADR-009:** Schema-driven client rendering. Schema with UI metadata served once; client renders forms from `(schema, data, role)`.
- **ADR-005:** SSE for real-time updates (not WebSockets).
- **ADR-007:** Strict CORS with explicit origin whitelist.
- **ADR-008:** TypeScript via Node.js strip-types (no build step).
- **ADR-010:** Effect resolution pipeline — explicit phases (`setBase` → formulas → `addFlat` → `multiply` → `cap` → flags), typed `Character` state, unified effect collection from all sources.
- **ADR-012:** Standards-first HTML, CSS & Web Platform conventions. Semantic markup, `@layer`/`@scope`/native nesting, native widgets over custom JS, modern CSS and Web APIs preferred.
- **ADR-013:** Domain layer as the mutation gate. `src/models/index.mts` is the single entry point for character mutations; storage is internal. Handlers and middleware import from `#models`, never `#models/storage` (carve-outs: `src/lib/backup.mts` and code inside `src/models/` itself).
- **ADR-014:** Per-slot combat, special attacks & reactions. `combat.carried` is `[Slot|null, Slot|null, Slot]`; index 2 is required and must reference a weapon with the `own` quality (default `natural_weapon`). Combat phase fans out per slot. `SpecialAttack[]` / `Reaction[]` are derived collections distinguished by `trigger === "manual"`. Tier stacking is additive. **Slot naming convention** — use names, not numbers, in prose / UI / commit messages: index 0 = **main-hand**, index 1 = **off-hand**, index 2 = **own**. The numeric tuple is an implementation detail; "slot 2" is ambiguous so don't write it.
- **ADR-015:** Typed effect targets, final vocabulary (supersedes ADR-011). `EffectTarget` is an 8-kind discriminated union; ordering is by pipeline phase, with **no `priority` field**. Per-kind predicate/condition support and valid modifiers:

  | Kind | Predicate / condition | Composition | Valid modifiers |
  | --- | --- | --- | --- |
  | `primary` | — | — | `addFlat`, `cap` (own pre-pipeline phase → `primaryEffective`) |
  | `secondary` | `condition: ArmorCondition[]` | AND across entries; OR within `values[]` | `setBase`, `addFlat`, `multiply`, `cap` |
  | `combat` | `appliesTo: WeaponPredicate[]` (per slot) | AND across entries; OR within `values[]` | `addFlat`, `multiply`, `cap`; `attackAttribute` → `setBase` only |
  | `weaponQuality` | — | — | `addFlat` (add), `remove` |
  | `armorQuality` | `condition: ArmorCondition[]` (per piece) | AND across entries; OR within `values[]` | `addFlat` (add), `remove` |
  | `flag` | — | — | `addFlat` (add), `remove` |
  | `magicAttribute` | — | — | `setBase` only |
  | `initiativeAttribute` | — | — | `setBase` only |

  - **Predicate/condition vocabulary & `§` pointers:** `WeaponPredicate` kinds are `any | type | quality | id` (narrows `combat` effects per weapon slot); `ArmorCondition` kinds are `armorQuality | armorId | armorSlot | noArmor` (gates `secondary` / `armorQuality` targets, §3f). The `remove` modifier is set-membership only — valid on `weaponQuality` / `armorQuality` / `flag` targets (§3a).
- **ADR-016:** Quality registry. `reference/qualities.{en,ru}.json` is the engine-canonical source of effects for weapon/armor qualities (single namespace, parametric ids via `_N` suffix, EN authoritative, locale-drift lint enforces structural alignment). Engine throws on unknown ids; production registry is loaded once at startup via `loadQualityIndex()` in `src/app.mts`.

### Retired Decisions (do not apply)

Do not apply any decision listed here. They are kept for historical context only; the superseding ADR is the sole authority.

- **ADR-004:** ~~Hybrid SPA with server-rendered HTML fragments.~~ Superseded by **ADR-009** (schema-driven client rendering).
- **ADR-011:** ~~Typed effect targets — initial discriminated-union design.~~ Superseded by **ADR-015** (final vocabulary).

## Coding Guidelines

### Import Ordering

Imports are ordered by category, separated by blank lines:

1. **`node:`** — Node.js built-in modules
2. **Functions** — value imports (functions, namespace `* as` imports)
3. **Constants** — all-caps / configuration values
4. **`import type`** — type-only imports

If an import line contains both functions and constants, order it by the
highest-priority item (functions > constants).

### Code & documentation conventions

The project-agnostic three-scale comment ladder (module header → function doc-comment → inline `//`), the what-to-comment guidance, and the keep-comments-current rule live in [`instructions/conventions.instructions.md`](instructions/conventions.instructions.md) (always loaded). Language specifics live in the matching instruction files:

- **Server `.mts`** — the non-trivial-module header rule: [`instructions/typescript.instructions.md`](instructions/typescript.instructions.md). [`src/rules/derived.mts`](../src/rules/derived.mts) is the reference shape.
- **Client `.mjs`** — no TypeScript syntax, client import ordering, and the `@param`/`@returns` JSDoc requirement: [`instructions/javascript.instructions.md`](instructions/javascript.instructions.md). [`public/api.mjs`](../public/api.mjs) is the reference shape.
- **DOM / CSS** — ADR-012 widget & modern-CSS preferences: [`instructions/hypertext.instructions.md`](instructions/hypertext.instructions.md), [`instructions/styling.instructions.md`](instructions/styling.instructions.md).

### Commands

```bash
npm run start:dev        # Dev server with file watcher
npm run typecheck        # TypeScript type-check (tsc --noEmit)
npm test                 # Run all tests: node --experimental-test-module-mocks --test test/**/*.test.mts
node --experimental-test-module-mocks --test test/foo.test.mts  # Run a single test file
```

### Testing

- Mirror the malizia project's test structure (`test/*.test.mts`)
- Use `node:test` (`describe`, `it`, `mock`) and `node:assert/strict`
- Mock external dependencies (filesystem, HTTP) using `node:test` mock utilities
- Tests run via: `node --experimental-test-module-mocks --test test/**/*.test.mts`
- `noUncheckedIndexedAccess` is enabled — array/index accesses return `T | undefined`. Use `!` non-null assertion on values you know exist (e.g. `mock.calls[0]!`) rather than adding unnecessary guards in test code.
- To mock subpath imports (e.g. `#config`, `#sse`), use `mock.module("#config", { namedExports: { ... } })` — this requires the `--experimental-test-module-mocks` flag (already in `npm test` and the single-test command above).
- **Mock-before-import gotcha — always import handlers dynamically inside `before()` after installing mocks:** `const { handleX } = await import("./foo.mts")` (same pattern `startTestServer` uses). A static top-level `import { handleX } from "./foo.mts"` evaluates `foo.mts` (and its transitive imports of `#config`, `#auth`, etc.) **before** any `mock.module(...)` call inside `before()` runs, so the handler closes over the real module and your mocks have no effect. Symptom: auth/permission tests pass with real values but fail with mocked ones.
- Shared test helpers live in `test/helpers/`: `fixtures.mts` (character factories), `temp-dir.mts` (isolated `DATA_DIR`), `http.mts` (test server), `mock-response.mts` (response spy). Use them rather than recreating test infrastructure.

### Static File Serving & URL Mapping

The server maps URLs to the filesystem as follows:

| URL prefix | Filesystem root | Notes |
| --- | --- | --- |
| `/assets/**` | `public/assets/` | Fonts, icons, images. Stripped of `/assets/` prefix. |
| `/uploads/portraits/**` | `data/uploads/portraits/` | Character portrait images. |
| `/**` (everything else) | `public/` | SPA client files (`.html`, `.mjs`, `.css`). Falls back to `index.html` for client-side routing. |

> Note: `reference/` is **not** served as static files. Its contents are exposed only through `/api/v1/{traits,talents,rituals,weapons,armor,qualities,statuses}` (which apply locale resolution and merging).

When rewriting or moving static file references, update both the HTML/CSS/JS `href`/`src` attributes **and** ensure the files exist at the corresponding filesystem path.

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
- Effect modifier types: `setBase`, `addFlat`, `multiply`, `cap`, `remove` (the last is set-membership only — `weaponQuality` / `armorQuality` / `flag` targets, ADR-015 §3a)
- Canonical RPG rules reference (attributes, formulas, effect tiers, combat) is kept as a Copilot repo memory (`nagara-rpg-rules.md`). When working on Phase 6 or rules-engine code, retrieve and cite the relevant section of `nagara-rpg-rules.md` in your response before proposing changes.

### Bug Trackers

- [`.github/bugs/`](bugs/README.md) holds the trackers. Open bugs live in domain-named markdown files there (currently `engine.md` and `infra.md`); resolved bugs are archived in `resolved.md`. See [`bugs/README.md`](bugs/README.md) for the full scheme.
- **Bug ids are global and permanent: `NB-<n>`.** Cite a bug from code as a bare `NB-<n>` (e.g. `// NB-31`) — never a filename, never `#`. Moving a bug (open → resolved, or re-triaging its severity) never changes its id, so cites keep resolving. Allocate the next id from `bugs/README.md` and bump the counter. If `bugs/README.md` is not available in context, do not guess or invent a bug id — ask the user for the current highest `NB-<n>` value before proceeding.
- On fixing a bug, mark it `✅ Resolved` and **move the entry to `resolved.md`** in the same commit. Resolved entries are archived, not deleted, so `NB-<n>` cites to closed bugs still resolve.
- These are **mutable trackers**, not stable repo facts. Do **not** put new bug trackers under `/memories/repo/`; that scope is `create`-only and unsuitable for living docs.

### Documentation discipline

The project-agnostic rules — stable-vs-ephemeral cite discipline, the `TODO(<scope>)` / `FIXME(<scope>)` / `NOTE:` comment-tag taxonomy, the plan "References to sweep on completion" bookkeeping, and the ADR stable-anchor rule — live in [`instructions/conventions.instructions.md`](instructions/conventions.instructions.md) (always loaded). The character-builder bindings:

- **Stable cite targets here:** ADRs in `docs/decisions/` (cite `ADR-NNN §anchor` from an ADR's "Stable anchors" table), `docs/*.md` (incl. [`docs/reference-authoring.md`](../docs/reference-authoring.md)), and the `.github/bugs/` NB trackers (`NB-N`; see Bug Trackers above). Plans, phase/chunk names, and numbered amendment items are **never** cite targets.
- **Enforcement:** `test/adr-anchors.test.mts` asserts every `ADR-NNN §anchor` cite resolves to that ADR's Stable-anchors table; `test/bug-anchors.test.mts` asserts every `NB-N` cite resolves to a tracker entry and that no id is duplicated. Every active plan under `.github/plans/` carries a "References to sweep on completion" list.

### Domain Layer (ADR-013)

- `src/models/index.mts` is **the** entry point for character mutations and reads
- Handlers, middleware, and `app.mts` import from `#models` only — never `#models/storage`
- Carve-outs: `src/lib/backup.mts` (snapshot tooling) and code inside `src/models/` itself
- Cross-cutting mutation invariants (recalc derived, SSE broadcast, write lock) live in the domain layer, not in handlers
- Transport-adjacent dependencies (`#sse`, `#rules`) are wired in via `createCharacterService({ recalc, broadcast, broadcastDeleted })` at app startup

## File Naming

- Server source: `src/**/*.mts`
- Tests: `test/**/*.test.mts`
- Client JS: `public/**/*.mjs` (plain JS, no TypeScript)
- Config: `config/*.env`, `config/*.mts`
- Scripts: `scripts/*.mts`
- RPG rules: `rpg/{locale}/**/*.md` (Obsidian Markdown vault)

## Operational Scripts

- `scripts/watcher.mts` — dev runner (`npm run start:dev`); forks
  `src/server.mts` and restarts on crash.
- `scripts/hard-delete.mts` — manual character cleanup that wraps
  `storage.hardDeleteCharacter` (so the JSON file, the per-character
  `data/uploads/portraits/<id>/` directory, **and** every `data/index.json`
  entry stay in sync). Reach for it whenever you would otherwise
  `Remove-Item` a character file by hand. Modes:
  - `node --experimental-strip-types scripts/hard-delete.mts <id>...`
    — delete one or more characters by id.
  - `node --experimental-strip-types scripts/hard-delete.mts --all`
    — wipe every character (used at chunk boundaries).
  - `node --experimental-strip-types scripts/hard-delete.mts
    --orphan-portraits` — sweep `data/uploads/portraits/` for directories
    whose id is no longer in the index (cleans up after past manual
    deletes that left dangling portraits).
  - Combine with `--dry-run` to preview without writing. ADR-013
  carve-out: this script imports `src/models/storage.mts` directly
  (sibling to `src/lib/backup.mts`); request handlers must keep going
  through `#models`.

## Roadmap

See [`docs/roadmap.md`](../docs/roadmap.md) for the full phased work plan and current status.

## Sibling Projects

When making changes that affect the character data model or API, check:

- `docs/addon-integration.md` — what the addon expects
- `docs/bot-integration.md` — what the Discord bot expects
- `docs/data-contracts.md` — canonical schema and API contract
- [nagara-addon/docs/data-contracts.md](https://github.com/skiotha/nagara-addon/blob/main/docs/data-contracts.md) — addon-side contract
- [malizia/docs/data-contracts.md](https://github.com/skiotha/malizia/blob/main/docs/data-contracts.md) — bot-side contract

If a proposed change is incompatible with a sibling contract, do not silently proceed. State the incompatibility explicitly, label it a **breaking change**, and propose either (a) a backwards-compatible alternative or (b) the minimum coordinated update needed across all three projects before the change can land.
