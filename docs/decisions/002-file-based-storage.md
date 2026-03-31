# ADR-002: File-Based JSON Storage

**Status:** Accepted
**Date:** 2026-03-31
**Deciders:** Project owner + Copilot design session

## Context

Character data needs to be persisted across server restarts. The options considered were:

**A. SQLite** — Embedded relational database. Excellent for structured data, supports concurrent reads, requires a native binding or WASM module.

**B. MongoDB** — Document database. Natural fit for JSON documents, but adds an external service dependency and requires an npm driver. (Used in the sibling `mychar` project where the data model warrants it.)

**C. File-based JSON** — One JSON file per character, plus an index file. Zero dependencies, human-readable, trivially inspectable and backable up.

## Decision

**Approach C — file-based JSON storage.**

Each character is stored as `data/characters/<uuid>.json`. An index file (`data/index.json`) maintains in-memory lookup maps (`byId`, `byBackupCode`, `byPlayer`, `all`) for fast access without scanning the filesystem.

### Directory Layout

```
data/
├── characters/
│   ├── <uuid-1>.json
│   └── <uuid-2>.json
├── index.json
├── aliases.json          (planned)
├── uploads/
│   └── portraits/
│       └── <uuid>/
└── backups/
    ├── characters/
    └── index.json
```

## Consequences

- **Positive:** Zero dependencies. No database process to manage.
- **Positive:** Human-readable files. Easy to inspect, manually edit in emergencies, copy to a backup drive, or version-control snapshots.
- **Positive:** Sufficient for the expected scale (~50 characters max).
- **Negative:** No built-in concurrency control. Two simultaneous writes to the same character could corrupt data. Mitigated by the small userbase (typically 1–2 concurrent users) and the SSE broadcast pattern (changes flow through a single PATCH handler). A write-serialization mechanism should be added if concurrency becomes a concern.
- **Negative:** No query language. All "queries" are index lookups or full-file reads. Acceptable for the data volume.
- **Negative:** Index must be kept in sync with files manually. A startup re-index or periodic consistency check may be needed.
