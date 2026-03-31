# ADR-009: Schema-Driven Client Rendering

**Status:** Accepted
**Date:** 2026-03-31
**Deciders:** Project owner + Copilot design session
**Supersedes:** [ADR-004](004-hybrid-spa-server-views.md) (Hybrid SPA with Server-Rendered Views)

## Context

The character builder originally used a hybrid approach ([ADR-004](004-hybrid-spa-server-views.md)): the server rendered HTML fragments via templates, the client fetched and injected them, then attached behaviors and SSE subscriptions for real-time updates.

This created **two rendering paths** that must agree on the same DOM structure:

1. **Server templates** — string-concatenation functions in `templates/*.mjs` that produce the initial HTML with `data-path`, `data-behavior`, `data-role-allowed` attributes baked in.
2. **Client update pipeline** — reactive state (`state.mjs`), field subscriptions via `subscribeField(path)`, DOM patching via `updateFieldValue()`, all driven by SSE JSON deltas.

The server templates were written before SSE existed. Once real-time updates were added, the client needed its own data-to-DOM pipeline anyway, making the server-rendered HTML merely a seed for a system that immediately takes over. Every field layout or attribute change requires touching both the server template and the client binding logic.

### Options Evaluated

**A. Full Client-Side Rendering (Pure JSON API)** — Server becomes a pure JSON API. Client fetches data and renders everything itself.

- ✓ Single rendering pipeline
- ✓ Server simplified; view changes are client-only
- ✗ Permission logic (what's visible, what's editable) duplicated between server validation and client rendering
- ✗ No structural guidance — each view is a bespoke render function

**B. Server Sends HTML via SSE (DOM Morphing)** — Server is the sole renderer. SSE pushes HTML fragments. Client diffs and patches the DOM.

- ✓ One rendering pipeline, server-authoritative
- ✗ Higher bandwidth per update (HTML vs JSON)
- ✗ Requires building a DOM morph algorithm (~200–300 lines)
- ✗ Fine-grained field updates become coarse (entire section HTML re-sent)
- ✗ Higher server CPU per connected client

**C. Schema-Driven Client Rendering** — The existing `CHARACTER_SCHEMA` is extended with UI metadata (section, label, display order, editability rules). The schema is served once and cached. A generic client-side renderer transforms `(schema, data, permissions) → DOM`. SSE updates feed new data into the exact same rendering pipeline.

- ✓ Single rendering path for initial render and real-time updates
- ✓ Single source of truth (the schema) for field presence, type, validation, and presentation
- ✓ Adding a field = updating the schema. Both render and update pick it up automatically
- ✓ Server retains validation authority (same schema)
- ✓ Existing behavior system (`data-behavior`, `enhanceElement`) works unchanged on client-generated DOM
- ✗ Schema grows beyond a pure data schema — it now encodes UI concerns
- ✗ Dashboard and landing page don't fit the form-rendering pattern (handled by dedicated render functions, not the schema renderer)
- ✗ Most upfront effort of the three options

## Decision

**Approach C — Schema-Driven Client Rendering.**

The pattern is known as **Schema-Driven UI** (also: Metadata-Driven UI, Model-Driven Rendering). In the form-generation domain: Schema-Driven Form Generation.

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                       SERVER                        │
│                                                     │
│  CHARACTER_SCHEMA ──→ GET /api/v1/schema            │
│  (data types, validation rules, UI metadata)        │
│                                                     │
│  Character JSON  ──→ GET /api/v1/characters/:id     │
│  Character delta ──→ SSE character-updated          │
│  Permissions     ──→ included in character response │
│                                                     │
│  Validation      ──→ PATCH handler (server-side,    │
│                      uses same schema)              │
└─────────────────────────────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌──────────────────────────────────────────────────────┐
│                       CLIENT                         │
│                                                      │
│  schema (cached)  ─┐                                 │
│  data (per char)  ─┼──→ renderer(schema, data, role) │
│  role (per req)   ─┘         │                       │
│                              ▼                       │
│                     DOM with data-path, data-behavior│
│                              │                       │
│                      enhanceElement() (behaviors)    │
│                              │                       │
│  SSE update ──→ setCurrentCharacter(newData)         │
│                     │                                │
│                     ▼                                │
│              subscribeField(path) fires              │
│              updateFieldValue(field, value)          │
│              (same pipeline as initial render)       │
└──────────────────────────────────────────────────────┘
```

### Schema Extension

The existing `CHARACTER_SCHEMA` already defines field paths, types, defaults, and validation rules. It will be extended with a `ui` property per field:

```typescript
interface SchemaFieldUI {
  section: string; // "attributes.primary" | "information.personal" | ...
  label: string; // Display label
  order: number; // Sort position within section
  component?: string; // Override render type: "portrait", "ability-list", etc.
  hidden?: boolean; // Never rendered (server-controlled fields like id, backupCode)
  editableBy?: string[]; // Roles that may edit: ["owner", "dm"]
  displayAs?: string; // "input" | "select" | "textarea" | "readonly" (default: inferred from type)
  options?: unknown[]; // For select fields: available choices
  hint?: string; // Tooltip text
}
```

Server-controlled fields (`id`, `backupCode`, `created`, `lastModified`) have `hidden: true` and are never rendered.

### Rendering Scope

| View               | Rendering approach                                                             |
| ------------------ | ------------------------------------------------------------------------------ |
| **Character view** | Schema-driven form renderer. Role determines editability                       |
| **Creation form**  | Same renderer, "creation" mode — all owner-editable fields are required inputs |
| **Dashboard**      | Dedicated render function (list of character cards, not a form)                |
| **Landing page**   | Dedicated render function (static content)                                     |

The schema-driven renderer handles the two most complex and duplication-prone views (character + creation). Dashboard and landing remain bespoke — they're simple and don't benefit from schema-driven rendering.

### Section Registry

Sections define the visual grouping and ordering of the character form:

```typescript
const SECTIONS = [
  { id: "attributes.primary", label: "Primary Attributes", order: 1 },
  { id: "attributes.secondary", label: "Secondary Attributes", order: 2 },
  { id: "sins", label: "Sins", order: 3 },
  { id: "portrait", label: "Portrait", order: 4 },
  { id: "experience", label: "Experience", order: 5 },
  { id: "abilities", label: "Abilities", order: 6 },
  { id: "information.personal", label: "Personal", order: 7 },
  { id: "information.equipment", label: "Equipment", order: 8 },
  { id: "information.mystic", label: "Mystic Powers", order: 9 },
  { id: "information.social", label: "Social", order: 10 },
];
```

### What Gets Removed

Once the migration is complete:

- `server/nagara/templates/` — all four template files
- `server/nagara/renderers/` — all four renderer files
- `GET /api/v1/view/*` — view endpoints replaced by `GET /api/v1/schema`
- `client/template-engine.mjs` — server-HTML hydration, no longer needed

### What Gets Added

- **Schema UI metadata** — extension of `CHARACTER_SCHEMA` in `src/models/character.mts`
- **`GET /api/v1/schema`** — serves the schema (cached, ETag-friendly)
- **Client form renderer** — `public/renderers/form-renderer.mjs` — generic `(schema, data, role) → DOM`
- **Client section components** — `public/components/section.mjs`, etc. for non-standard sections (portrait, abilities)
- **Client view updates** — `character-view.mjs` and `creation-view.mjs` call the renderer instead of fetching server HTML

### Migration Strategy

The migration is incremental. Each step leaves the application functional:

1. **Extend schema** with UI metadata. No visible changes.
2. **Build form renderer** on the client. Not wired in yet.
3. **Convert character view** to use renderer + JSON API. Remove server character template.
4. **Convert creation view** to reuse the same renderer in creation mode. Remove server creation template.
5. **Convert dashboard** to a client-rendered list from JSON. Remove server dashboard template.
6. **Convert landing page** to client-rendered. Remove server initial template.
7. **Remove server view layer** — templates, renderers, view route handlers, view endpoints.
8. **Add `GET /api/v1/schema`** endpoint (can happen at any point during migration).

## Consequences

- **Positive:** Single rendering pipeline. Initial render and SSE updates use the same `(schema, data) → DOM` path. No divergence.
- **Positive:** Adding or modifying a field requires updating only the schema. Both server validation and client rendering derive from it.
- **Positive:** Server becomes a simpler, pure JSON API. Easier to test. No string-template maintenance.
- **Positive:** The existing behavior system (`data-behavior`, `enhanceElement()`, `cleanupBehaviors()`) works unchanged — it processes any DOM with the right attributes, regardless of who generated it.
- **Positive:** The existing state system (`subscribeField`, `setCurrentCharacter`, diff-based notification) works unchanged. SSE updates feed data into the same pipeline.
- **Negative:** The schema takes on UI concerns (section, label, display order). It's no longer a pure data schema — it's a UI model. This is an intentional trade-off: one schema to maintain vs. two rendering paths.
- **Negative:** Custom sections (portrait upload, ability list with add/remove) need component overrides in the renderer. The renderer can't be purely generic.
- **Negative:** Dashboard and landing page don't benefit from the schema renderer and remain bespoke. This is acceptable — they're simple views.
- **Acceptable:** The upfront effort is the highest of the three options, but it pays off immediately in reduced maintenance burden and eliminated duplication.
