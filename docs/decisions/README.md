# Architecture Decision Records

Records of architecturally significant decisions for the Nagara Character
Builder. Each ADR captures the context, the options considered, the
decision, and its consequences. ADRs are append-only — superseded
decisions are marked as such, not deleted.

| #   | Title                                                                         | Status     |
| --- | ----------------------------------------------------------------------------- | ---------- |
| 001 | [Zero external dependencies](001-zero-dependencies.md)                        | Accepted   |
| 002 | [File-based JSON storage](002-file-based-storage.md)                          | Accepted   |
| 003 | [Self-asserted player identity](003-self-asserted-identity.md)                | Accepted   |
| 004 | [Hybrid SPA with server-rendered HTML fragments](004-hybrid-spa-server-views.md) | Superseded by ADR-009 |
| 005 | [Server-Sent Events for real-time updates](005-sse-realtime.md)               | Accepted   |
| 006 | [Project restructure](006-project-restructure.md)                             | Accepted   |
| 007 | [Strict CORS with explicit origin whitelist](007-strict-cors.md)              | Accepted   |
| 008 | [TypeScript via Node.js strip-types](008-typescript-strip-types.md)           | Accepted   |
| 009 | [Schema-driven client rendering](009-schema-driven-rendering.md)              | Accepted   |
| 010 | [Effect resolution pipeline architecture](010-effect-resolution-pipeline.md)  | Accepted   |
| 011 | [Typed effect targets](011-typed-effect-targets.md)                           | Accepted   |
| 012 | [Standards-first HTML, CSS & Web Platform conventions](012-standards-first-html-css.md) | Accepted |
| 013 | [Domain layer as the mutation gate](013-domain-layer-mutation-gate.md)        | Accepted   |
