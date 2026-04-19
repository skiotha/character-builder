# ADR-013: Domain Layer as the Mutation Gate

**Status:** Accepted
**Date:** 2026-04-19
**Deciders:** Project owner + Copilot design session
**Related:** [ADR-002](002-file-based-storage.md) (File-Based Storage)

## Context

The codebase has three nominal server layers — handlers (`src/routes/`), domain functions (`src/models/index.mts`), and storage (`src/models/storage.mts`) — but the discipline between them has eroded.

### Current state (2026-04-19)

Both `src/models/index.mts` and `src/models/storage.mts` export a function named `updateCharacter`. They are **not** equivalent:

| Concern                | Service version (`index.mts`)             | Storage version (`storage.mts`)                   |
| ---------------------- | ----------------------------------------- | ------------------------------------------------- |
| `deepMerge` options    | default                                   | `{ skipUndefined: true }`                         |
| Index maintenance      | full rewrite via `saveCharacter`          | conditional `updateIndexMetadata` only on changes |
| Domain post-processing | none                                      | none                                              |

Handlers and middleware import from whichever layer is closest to hand:

| Caller                              | Imports from         |
| ----------------------------------- | -------------------- |
| `handleCreateCharacter`             | `#models` (service)  |
| `handleUpdateCharacter`             | `#models/storage`    |
| `handleUploadPortrait`              | `#models` (service — gets the worse `updateCharacter`) |
| `handleGetCharacters`               | `#models` (service)  |
| `handleStreamCharacter`             | `#models/storage`    |
| `middleware/characterPermissions`   | `#models/storage`    |
| `app.mts` (DELETE, recover)         | `#models` (service)  |
| `lib/backup.mts`                    | `#models/storage`    |

This has two consequences:

1. **Latent correctness bug.** `handleUploadPortrait` passes the entire character object through the service `updateCharacter`. Without `skipUndefined`, any in-flight `undefined` field overwrites the stored  value. The bug has not bitten yet only because portrait uploads happen to keep all fields populated.
2. **No place for cross-cutting invariants.** Recalculating derived fields, broadcasting SSE updates, and (future) per-character write serialization or optimistic concurrency have no natural home. Each handler is on the honor system to remember every step. Forgetting any one of them produces a silently inconsistent system.

### Why the storage layer cannot own these invariants

Storage knows about files, paths, and the in-memory index. It has no reason to know that derived stats need recalculating, or that subscribers need notifying. Pushing those concerns into storage would couple file I/O to transport (SSE) and to the rules engine — the wrong direction.

### Why the handler layer cannot own these invariants

Handlers exist to translate HTTP into domain calls and back. They already own status codes, header writes, body parsing, response sanitization, and error mapping. Adding "remember to also recalc, broadcast, and acquire the write lock" to every handler that mutates a character is exactly the discipline that has already failed once.

## Decision

The domain layer in `src/models/` is **the** entry point for character mutations. Storage becomes an internal CRUD module.

### Layer responsibilities

| Layer                 | Owns                                                                   | Does **not** own                              |
| --------------------- | ---------------------------------------------------------------------- | --------------------------------------------- |
| **Handlers** (`src/routes/`) | Request parsing, status codes, response shape, response sanitization, error→HTTP mapping | Persistence, derived recalc, broadcast        |
| **Domain layer** (`src/models/index.mts`) | Mutation invariants: merge, stamp, recalc derived, broadcast, write lock | HTTP concerns, file paths, index maintenance  |
| **Storage** (`src/models/storage.mts`)    | File I/O, in-memory index, write serialization primitive               | Domain semantics, transport awareness         |

### Convention

> **Outside `src/models/`, code MUST NOT import from `#models/storage`.**
>
> All character mutations and reads go through the domain layer
> (`#models`). Two narrow exceptions:
>
> 1. `src/lib/backup.mts` — snapshot tooling, intentionally low-level.
> 2. Anything inside `src/models/` itself.
>
> Middleware and handlers that today reach into `#models/storage` for
> reads must be migrated to `#models`.

### Concrete changes

1. **Single `updateCharacter` implementation.** Domain `updateCharacter` delegates to the storage version (with `skipUndefined: true` and conditional index maintenance). The storage version is no longer imported outside `src/models/`.
2. **Recalc + broadcast move into the domain layer.** Domain `updateCharacter` calls `recalculateDerivedFields` and `broadcastToCharacter` after persisting. Handlers stop calling them directly.
3. **Write lock lives in storage.** Per-character `Map<string, Promise>` write lock at the storage layer protects against any future leak of the "no-storage-imports" convention. Same code regardless of where it lives.
4. **Dependency injection for transport-adjacent dependencies.** The domain layer should not import from `#sse` or `#rules` at module level (layering inversion: models → transport, models → rules engine). Instead, an app-startup factory `createCharacterService({ recalc, broadcast })` wires the dependencies and exports the bound functions. This keeps `models/` free of transport knowledge and makes the domain layer trivially testable with stub injectors.

### Non-goals

- **Optimistic concurrency / lost-update prevention** is intentionally out of scope. It requires client-facing surface (new 409 status, new request header or body field, client retry logic). Implementation is tracked separately. The write lock prevents file corruption; preventing lost updates is a separate UX problem.
- **Renaming `src/models/`.** The folder is the domain layer in practice; renaming would churn every import site. The name stays. ADR text uses "domain layer" or "domain functions in `src/models/`" to describe the concept.
- **Introducing classes, DI containers, or `CharacterService`-style OOP ceremony.** Plain module-as-namespace is sufficient at this scale. The factory in point 4 above is a single function that returns an object of bound functions.

## Consequences

### Positive

- One `updateCharacter`, one set of merge semantics, no latent `skipUndefined` bug.
- A natural home for cross-cutting mutation invariants. Adding a new invariant (audit log, event sourcing, optimistic concurrency) is one edit in the domain layer instead of an audit of every handler.
- Handlers shrink to HTTP translation. Easier to read, easier to test.
- Backup tool stays low-level by explicit carve-out, not by accident.
- The convention is enforceable by review (and later by lint rule, if needed: `no-restricted-imports` on `#models/storage` for files outside `src/models/` and `src/lib/backup.mts`).

### Negative / costs

- One-time migration cost: ~5 import sites need updating, plus moving recalc/broadcast calls out of `handleUpdateCharacter` and `handleUploadPortrait`.
- Reading a character now goes through one extra function call. No measurable cost for a file-based store; effectively free.
- Test helpers (`test/helpers/`) that may bypass the domain layer need auditing during the migration.

### Followups

- A future ADR may add optimistic concurrency once UX is designed.
- If the dependency-injection factory pattern proves clumsy for tests, revisit whether direct imports from `#sse`/`#rules` in `models/` are acceptable. The cost of layering inversion is small at this scale.
