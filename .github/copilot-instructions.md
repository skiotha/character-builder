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
- **ADR-004:** ~~Hybrid SPA with server-rendered HTML fragments.~~ Superseded by ADR-009.
- **ADR-009:** Schema-driven client rendering. Schema with UI metadata served once; client renders forms from `(schema, data, role)`.
- **ADR-005:** SSE for real-time updates (not WebSockets).
- **ADR-007:** Strict CORS with explicit origin whitelist.
- **ADR-008:** TypeScript via Node.js strip-types (no build step).
- **ADR-010:** Effect resolution pipeline — explicit phases (`setBase` → formulas → `addFlat` → `multiply` → `cap` → flags), typed `Character` state, unified effect collection from all sources.
- **ADR-011:** ~~Typed effect targets — initial discriminated-union design.~~ Superseded by ADR-015.
- **ADR-012:** Standards-first HTML, CSS & Web Platform conventions. Semantic markup, `@layer`/`@scope`/native nesting, native widgets over custom JS, modern CSS and Web APIs preferred.
- **ADR-013:** Domain layer as the mutation gate. `src/models/index.mts` is the single entry point for character mutations; storage is internal. Handlers and middleware import from `#models`, never `#models/storage` (carve-outs: `src/lib/backup.mts` and code inside `src/models/` itself).
- **ADR-014:** Per-slot combat, special attacks & reactions. `combat.carried` is `[Slot|null, Slot|null, Slot]`; index 2 is required and must reference a weapon with the `own` quality (default `natural_weapon`). Combat phase fans out per slot. `SpecialAttack[]` / `Reaction[]` are derived collections distinguished by `trigger === "manual"`. Tier stacking is additive. **Slot naming convention** — use names, not numbers, in prose / UI / commit messages: index 0 = **main-hand**, index 1 = **off-hand**, index 2 = **own**. The numeric tuple is an implementation detail; "slot 2" is ambiguous so don't write it.
- **ADR-015:** Typed effect targets, final vocabulary (supersedes ADR-011). 8-kind discriminated union (`secondary | combat | weaponQuality | armorQuality | flag | primary | magicAttribute | initiativeAttribute`), `WeaponPredicate` (`any | type | quality | id`, AND-composed via `appliesTo` for per-slot weapon narrowing), `ArmorCondition` (`armorQuality | armorId | armorSlot | noArmor`, AND-composed via `condition` for character-level / per-armor-piece gating on `secondary` and `armorQuality` targets, §3f), per-phase `EffectModifier` shapes including `remove`, no `priority` field.
- **ADR-016:** Quality registry. `reference/qualities.{en,ru}.json` is the engine-canonical source of effects for weapon/armor qualities (single namespace, parametric ids via `_N` suffix, EN authoritative, locale-drift lint enforces structural alignment). Engine throws on unknown ids; production registry is loaded once at startup via `loadQualityIndex()` in `src/app.mts`.

## Coding Guidelines

### Import Ordering

Imports are ordered by category, separated by blank lines:

1. **`node:`** — Node.js built-in modules
2. **Functions** — value imports (functions, namespace `* as` imports)
3. **Constants** — all-caps / configuration values
4. **`import type`** — type-only imports

If an import line contains both functions and constants, order it by the
highest-priority item (functions > constants).

### Code Documentation

Written code carries explanatory comments at three scales. Pick the right one for the change you're making:

- **Top-of-file module header** — use for any non-trivial `.mts` module (rules engine, models, multi-step routes). Document the module's purpose, where it sits in the larger flow, and any cross-cutting invariants. The header in [`src/rules/derived.mts`](../src/rules/derived.mts) (numbered pipeline overview) is the reference shape. Keep it current when the pipeline changes.
- **Function-level JSDoc block** — use above any exported function whose contract isn't obvious from the signature, and above any non-exported function with non-trivial semantics. In `.mts` write a `/** ... */` block describing **what the function guarantees** (not what it does line-by-line) and any preconditions / phase ordering it relies on. In **client `.mjs` files use JSDoc descriptions consistently** — they're the only type signal and the existing client code (e.g. [`public/api.mjs`](../public/api.mjs)) is fully annotated; new client functions should match.
- **Inline `//` comments** — use for non-obvious branches, phase markers (`// ── N. addFlat ─────`), and for citing the ADR / Bug / weak-points entry that explains *why* the code does what it does. Prefer `// Bug #31.` or `// ADR-015 §3f` over restating the rule.

Don't comment trivial mechanics (variable names speak for themselves). Do comment: invariants the engine depends on, non-obvious resets / orderings, gotchas that already burned someone (the mock-before-import gotcha below is the model).

When you change a behaviour the comments describe, update the comments in the same edit. Stale doc-comments are worse than missing ones.

### Commands

```bash
npm run start:dev        # Dev server with file watcher
npm run typecheck        # TypeScript type-check (tsc --noEmit)
npm test                 # Run all tests: node --test test/**/*.test.mts
node --experimental-test-module-mocks --test test/foo.test.mts  # Run a single test file
```

### Testing

- Mirror the malizia project's test structure (`test/*.test.mts`)
- Use `node:test` (`describe`, `it`, `mock`) and `node:assert/strict`
- Mock external dependencies (filesystem, HTTP) using `node:test` mock utilities
- Tests run via: `node --experimental-test-module-mocks --test test/**/*.test.mts`
- `noUncheckedIndexedAccess` is enabled — array/index accesses return `T | undefined`. Use `!` non-null assertion on values you know exist (e.g. `mock.calls[0]!`) rather than adding unnecessary guards in test code.
- To mock subpath imports (e.g. `#config`, `#sse`), use `mock.module("#config", { namedExports: { ... } })` — this requires the `--experimental-test-module-mocks` flag (already in `npm test` and the single-test command above).
- **Mock-before-import gotcha:** A static `import { handleX } from "./foo.mts"` at the top of a test file evaluates `foo.mts` (and its transitive imports of `#config`, `#auth`, etc.) **before** any `mock.module(...)` call inside `before()` runs. The handler then closes over the real module and your mocks have no effect. Fix: import the handler dynamically *after* the mock is installed — `const { handleX } = await import("./foo.mts")` inside the `before()` hook (same pattern `startTestServer` uses). Symptom: auth/permission tests pass with real values but fail with mocked ones.
- Shared test helpers live in `test/helpers/`: `fixtures.mts` (character factories), `temp-dir.mts` (isolated `DATA_DIR`), `http.mts` (test server), `mock-response.mts` (response spy). Use them rather than recreating test infrastructure.

### Static File Serving & URL Mapping

The server maps URLs to the filesystem as follows:

| URL prefix | Filesystem root | Notes |
| --- | --- | --- |
| `/assets/**` | `public/assets/` | Fonts, icons, images. Stripped of `/assets/` prefix. |
| `/uploads/portraits/**` | `data/uploads/portraits/` | Character portrait images. |
| `/**` (everything else) | `public/` | SPA client files (`.html`, `.mjs`, `.css`). Falls back to `index.html` for client-side routing. |

> Note: `reference/` is **not** served as static files. Its contents are exposed only through `/api/v1/{traits,talents,rituals,weapons,armor,qualities}` (which apply locale resolution and merging).

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
- Canonical RPG rules reference (attributes, formulas, effect tiers, combat) is kept as a Copilot repo memory (`nagara-rpg-rules.md`). Surface it explicitly when working on Phase 6 / engine code.

### Bug Trackers

- `.github/bugs/engine-weak-points.md` — RPG engine bugs and design weaknesses
- `.github/bugs/api-infra-bugs.md` — API, HTTP, security, validation infrastructure bugs (also lists Phase 5-deferred ops items: `x-forwarded-for` parsing, persistent rate-limit state, generalizing the limiter)
- These are **mutable trackers**, not stable repo facts — edit them as bugs are opened/closed. Do **not** put new bug trackers under `/memories/repo/`; that scope is `create`-only and unsuitable for living docs.

### Documentation discipline

- **Stable cite targets** for code comments / JSDoc / test titles: ADRs (`ADR-NNN`, or `ADR-NNN §anchor` from an ADR's "Stable anchors" table), `docs/*.md`, and `.github/bugs/*.md #N` (spell the file — numbering is per-tracker). **Never** cite `.github/plans/*`, phase names, chunk letters, or numbered amendment items from code; plans are short-lived and archived to `done/` once shipped.
- **The one allowed plan reference** is inside a `TODO(<scope>)` whose lifetime matches the plan's — remove the TODO and its cite together when the plan ships.
- **Comment tags:** `TODO(<scope>)` (missing capability; may append `Tracked in .github/plans/<file>.md`); `FIXME(<scope>)` (known-broken path; cite `.github/bugs/*`); plain `//` / `NOTE:` (stable prose, no plan cites).
- **Enforcement:** `test/adr-anchors.test.mts` asserts every `ADR-NNN §anchor` cite resolves to that ADR's Stable-anchors table. Every active plan under `.github/plans/` carries a "References to sweep on completion" list of the `TODO(<scope>)` sites to revisit when it ships.

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

See `docs/roadmap.md` for the full phased work plan. Quick reference:

| Phase | Focus                            | Status      |
| ----- | -------------------------------- | ----------- |
| 0     | Documentation & decisions        | ✅ Done     |
| 1     | Project restructure              | ✅ Done     |
| 2     | TypeScript migration             | ✅ Done     |
| 3     | Schema-driven rendering          | ✅ Done     |
| 4     | Testing                          | ✅ Done\*   |
| 5     | Bug fixes & hardening            | ✅ Done     |
| 6     | RPG Engine                       | In progress |
| 7     | Sibling project integration      | Not started |
| 8     | Polish & beyond MVP              | Not started |

\* _Server-side tests complete (607 as of 2026-05-09). Engine + client-side test suites run alongside Phases 6 and 8 respectively. Phase 6 is mid-flight: Chunks A–F shipped (per-slot combat, typed effects, quality registry, bulk reference normalization); a Chunk-F post-pass amendment is closing remaining engine items — see [`.github/plans/phase6-plan.md`](../.github/plans/phase6-plan.md) and [`.github/plans/done/phase6-chunkF-postpass-amendment.md`](../.github/plans/done/phase6-chunkF-postpass-amendment.md)._

## Sibling Projects

When making changes that affect the character data model or API, check:

- `docs/addon-integration.md` — what the addon expects
- `docs/bot-integration.md` — what the Discord bot expects
- `docs/data-contracts.md` — canonical schema and API contract
- [nagara-addon/docs/data-contracts.md](https://github.com/skiotha/nagara-addon/blob/main/docs/data-contracts.md) — addon-side contract
- [malizia/docs/data-contracts.md](https://github.com/skiotha/malizia/blob/main/docs/data-contracts.md) — bot-side contract
