# ADR-001: Zero External Dependencies

**Status:** Accepted
**Date:** 2026-03-31
**Deciders:** Project owner + Copilot design session

## Context

The Nagara Character Builder runs a raw Node.js HTTP server with no npm dependencies. This choice echoes the addon project's ADR-001 (zero external Lua libraries) and applies the same reasoning to the website.

The project serves a small, closed group of users (~5–15 people). There is no need for the ecosystem breadth that Express, Fastify, or similar frameworks provide. The Node.js standard library (`node:https`, `node:fs`, `node:crypto`, `node:test`) covers every current requirement.

## Decision

The website backend will carry **zero npm runtime dependencies**.

| Need                | Solution                                    | Notes                     |
| ------------------- | ------------------------------------------- | ------------------------- |
| HTTP server         | `node:http` / `node:https`                  | —                         |
| Routing             | Custom router function                      | Single file, < 100 LOC    |
| Body parsing (JSON) | `req.on('data')` + `JSON.parse()`           | With size limit           |
| Multipart parsing   | Custom parser in `multipart.mts`            | For portrait uploads only |
| File storage        | `node:fs/promises`                          | JSON files on disk        |
| Cryptographic IDs   | `crypto.randomUUID()`                       | Built-in since Node 19    |
| Types               | TypeScript via `--experimental-strip-types` | `noEmit`, devDep only     |
| Testing             | `node:test` + `node:assert/strict`          | Built-in since Node 18    |
| SSE                 | Raw `res.write()` with event format         | —                         |

`@types/node` is the sole `devDependency`.

## Consequences

- **Positive:** No `node_modules` at runtime. No supply-chain risk. No version conflicts across the three Nagara projects.
- **Positive:** Full control over every line. Easy to understand, debug, and reason about.
- **Negative:** Must implement routing, body parsing, and multipart handling by hand. Acceptable for the project's scope and complexity.
- **Negative:** If a future feature requires something heavy (WebSockets, compression, database drivers), we may add a targeted dependency. That would be a new ADR, not a blanket framework adoption.
