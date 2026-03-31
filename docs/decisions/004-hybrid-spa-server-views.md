# ADR-004: Hybrid SPA with Server-Rendered Views

**Status:** Superseded by [ADR-009](009-schema-driven-rendering.md)
**Date:** 2026-03-31
**Deciders:** Project owner + Copilot design session

## Context

The client needs to display several distinct views: initial/login screen, dashboard (character list), character creation form, and the full character sheet. Two approaches were considered:

**A. Pure SPA** — Client fetches JSON data and renders everything in JavaScript with DOM manipulation or a template engine.

**B. Server-rendered pages** — Server returns full HTML pages, traditional multi-page application.

**C. Hybrid** — Server returns HTML _fragments_ via an API, client SPA fetches and injects them into the DOM, then attaches interactive behaviors.

## Decision

**Approach C — hybrid SPA with server-rendered HTML fragments.**

- The server exposes view endpoints (`/api/v1/view/initial`, `/api/v1/view/dashboard`, `/api/v1/view/creation`, `/api/v1/view/character/:id`) that return HTML fragments.
- The client is a vanilla JS SPA that fetches these fragments via `fetch()`, injects them into the `#app` container, and attaches behaviors (editable fields, selectable elements, copyable text, etc.) via a declarative data-attribute system.
- Character data for real-time updates comes via JSON API + SSE, not re-fetched HTML.

### Why

- Server-rendered views allow the schema, permissions, and templates to live in one place (the server), avoiding duplication of business logic on the client.
- The client stays simple: no template engine, no state-to-DOM reconciliation for the initial render.
- Real-time updates (SSE) still work with direct DOM patching from JSON deltas — the initial HTML is just the starting point.

## Consequences

- **Positive:** Single source of truth for field visibility, labels, layout — all driven by the schema and permissions on the server.
- **Positive:** Client code is minimal. No build step, no framework.
- **Negative:** Each view has a server-side template (string concatenation in JavaScript) that is verbose and harder to maintain than a proper template language.
- **Negative:** Tighter coupling between server and client than a pure JSON API + SPA approach. View changes require server deployment.
- **Acceptable:** For this project's scale, the trade-off is worthwhile. If the client grows significantly, the view endpoints could be replaced with pure JSON while keeping the same SPA shell.

## Superseded

The introduction of SSE for real-time updates ([ADR-005](005-sse-realtime.md)) created a second rendering path on the client — reactive state, field subscriptions, and direct DOM patching — making the server-rendered HTML merely a seed for a pipeline that immediately takes over. This resulted in two rendering systems that must agree on the same DOM structure, doubling the maintenance cost for any field or layout change.

[ADR-009](009-schema-driven-rendering.md) replaces this approach with **Schema-Driven Client Rendering**: the character schema is extended with UI metadata and served once; the client renders all form views from `(schema, data, role)` using the same path for both initial render and SSE-driven updates. The server becomes a pure JSON API.
