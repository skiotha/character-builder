# ADR-017: Client Component Lifecycle — Custom Elements and Structural Change Detection

**Status:** Accepted
**Date:** 2026-09-02
**Deciders:** Project owner + Copilot design session
**Amends:** [ADR-009](009-schema-driven-rendering.md) (one consequence — see §7)
**Related:** [ADR-005](005-sse-realtime.md) (SSE feeds the client state),
[ADR-012](012-standards-first-html-css.md) (standards-first: prefer native platform capabilities)

## Context

ADR-009 moved rendering to the client: a generic form renderer turns
`(schema, data, role)` into DOM, native controls carry `data-path`, and the
state module diffs each incoming character against the previous one and
notifies per-path subscribers, which patch the DOM with `updateFieldValue()`.
ADR-009 also acknowledged that some sections need **component overrides**
(portrait, trait / talent lists, weapon slots) because they are not a single
control bound to a single path, and recorded as a consequence that "the
existing state system works unchanged".

That consequence turned out to be true only for leaf controls. Verified
in-browser on 2026-09-02 against the current client:

- `bindFieldsToState` subscribed **every** `[data-path]` element — component
  roots included — to `updateFieldValue()`, which treats any non-control as
  a text output. One main-hand slot change (PATCH → 200) left
  `OL[data-path=combat.carried]`, `UL[data-path=traits]` and the
  `equipment.weapons` stub reading `"[object Object]"`, their children gone.
- `notifyChangedPaths` flattened the character with arrays as leaves and
  compared leaves with `!==`; every response is fresh JSON, so every array
  path "changed" on every `setCurrentCharacter` — which runs twice per PATCH
  (own response + SSE echo).
- Objects flatten into leaves nobody subscribes to, so a component bound to
  an object path (portrait) never heard about changes at all.
- Components read sibling data (`weapon-slots` needs `equipment.weapons`)
  from global state at render time with no way to declare that dependency,
  be re-rendered when it changes, or release listeners on view teardown
  beyond the view's ad-hoc `_unsubscribe` sweep.

Phase 6 Chunk I adds five more components (catalog pickers), each of whose
acceptance criteria is "the component reflects its own PATCH result and SSE
updates". The client therefore needs a real component contract: re-render on
declared dependency change, leak-free teardown, no spurious work, access to
the whole character, compatibility with a future create-mode data source,
and all of it with zero dependencies and no build step (ADR-001, ADR-008).

### Alternatives considered

| Approach | Rejected because |
| --- | --- |
| **Guard the leaf binding only** (skip component roots) | Stops the clobber, but components never update after their own PATCH or on SSE. Necessary in every option; insufficient alone. |
| **Components self-subscribe and `replaceWith()` themselves** | Boilerplate per component; the replaced node loses its unsubscribe handle, so subscriptions leak on view teardown; spurious rebuilds close an open `<select>` mid-interaction. |
| **Renderer-owned lifecycle** (components return `{ el, update, destroy }`; the view wires and tears down) | Sound, but re-implements what the platform already provides — an instance registry and explicit destroy bookkeeping. Kept as the fallback had custom elements been rejected. |
| **Rebuild the whole form on every state change** | Destroys focus, in-progress inline edits, portrait pan-zoom state and open dropdowns. A DOM-diffing library would mitigate that but breaks the no-build, no-dependency client. |
| **Shadow DOM / form-associated / customized built-ins (`is=`)** | Shadow DOM would isolate the `@layer` / `@scope` stylesheets and native widgets for no benefit; `is=` lacks Safari support; neither is needed for light-DOM lifecycle hooks. |

## Decision

### 1. Component overrides are light-DOM custom elements

Every schema `ui.component` override is a custom element named `nagara-*`
(`<nagara-weapon-slots>`, `<nagara-portrait>`, …), defined with
`customElements.define` at module import. **No shadow DOM**: the host is a
plain light-DOM element with `display: contents`, so it is layout-transparent
and the existing `@layer` / `@scope` stylesheets, native controls and
accessibility tree inside it are unaffected. The component owns its inner
markup (`ol.weapon-slots`, `section#portrait`, …); the host carries
`data-path` for discovery only. This is the platform's component model, in
line with ADR-012's preference for native capabilities over custom JS.

### 2. The base-class contract (`NagaraElement`)

All component elements extend one base class in `public/components/base.mjs`:

- **Props set by the factory:** `path`, `fieldSchema`, `role`, `mode`, and
  `character` (the data the renderer already holds).
- **`static deps`** — the subtree roots the element depends on, as dotted
  paths (e.g. `["combat.carried", "equipment.weapons"]`). An empty list means
  the element never re-renders from state.
- **`connectedCallback()`** — in `view` mode, subscribe to every dep via the
  state module, then `render(this.character ?? currentCharacter)`.
  **`disconnectedCallback()`** — unsubscribe and `cleanupBehaviors(this)`.
  Teardown is therefore automatic whenever the router replaces a view.
- **`update()`** — coalesces all dep notifications produced by one
  `setCurrentCharacter` into a single `render` (microtask).
- **`render(character)`** — the component's only rendering entry point. It
  receives its data as the argument and **never reads global state**; it may
  rebuild its children or patch them in place (portrait must patch, because
  its upload handler holds DOM references); it calls `enhanceElement(this)`
  for any `data-behavior` it emitted. The argument rule is what lets a
  future create-mode host feed form-local data through the same method.

### 3. Two update paths, strictly separated

- **Native leaf controls** (`input`, `select`, `textarea`, `output` with
  `data-path`) are bound by the view: `subscribeField(path)` →
  `updateFieldValue()`. Nothing else is bound this way — component hosts and
  any other element are never targets of `updateFieldValue()`.
- `updateFieldValue()` skips a control that currently has `data-editing`;
  the inline-edit flow's own PATCH response supplies the final value on blur.
- **Component hosts** manage themselves through §2.

### 4. Structural change detection

The state module computes the change set of a `setCurrentCharacter` with a
pure, DOM-free `changedPaths(oldCharacter, newCharacter)`:

- Leaf values are compared with **structural (deep) equality**; arrays are
  leaves for diffing purposes.
- The change set contains every changed leaf path **plus every ancestor
  path and the root** (`""`), each notified once. A component with
  `deps = ["portrait"]` therefore hears about `portrait.crop.x`.
- Identical data produces **no notifications** — the SSE echo of a client's
  own PATCH is a no-op, so open dropdowns and focus survive it.
- Top-level keys prefixed with `_` are transport metadata (`_permissions`
  is attached only by `GET /characters/:id`; PATCH responses and SSE payloads
  omit it) and are excluded from the diff. The state module keeps the last
  received `_permissions` when an incoming payload lacks it, so role-dependent
  rendering never loses its input.

Because the diff is DOM-free it lives in `public/utils/diff.mjs` and is
covered by `node:test` directly — the first automated coverage of client
code.

### 5. Registry and renderer contract

`getComponent(name)` returns a factory
`(path, fieldSchema, value, role, mode, data) → HTMLElement`. The renderer
passes the full `data` it already has as the sixth argument; a component
factory creates its element, assigns the props from §2, and returns it.
Placeholder stubs for not-yet-implemented components remain plain elements
(they are never bound, per §3).

### 6. One transport helper

Every client PATCH goes through `api.patchCharacter(id, updates)`, which
attaches the `x-player-id` / `x-dm-id` headers once and returns the parsed
response. Components and behaviors do not hand-roll `fetch` + headers.

### 7. Amendment to ADR-009

ADR-009's consequence "the existing state system (`subscribeField`,
`setCurrentCharacter`, diff-based notification) works unchanged" is narrowed:
it holds for **leaf controls** (§3); component overrides follow this ADR.
ADR-009 remains the authority for schema-driven rendering itself.

### 8. Create mode

Elements created with `mode === "create"` take no state subscriptions and
render once from the `character` prop. Nothing more is built here; the
sanctioned path to creation-time reactivity is a stateless preview endpoint
(roadmap Phase 8), which would call `render(localData)` through the same §2
contract.

## Stable anchors

Code cites these with `ADR-017 §<anchor>`. `test/adr-anchors.test.mts`
asserts every such citation resolves to a row below. Renaming or
renumbering a listed anchor is a breaking change for those citations.

| Anchor | Rule |
| --- | --- |
| `§light-dom` | Component overrides are light-DOM custom elements (`nagara-*`), never shadow DOM; hosts are `display: contents` and carry `data-path` for discovery only. |
| `§deps` | A component declares `static deps` (subtree roots); the base class subscribes on connect, unsubscribes on disconnect, and coalesces one state set into one render. |
| `§render-arg` | `render(character)` receives its data as the argument and never reads global state; the first render uses the data the renderer passed. |
| `§structural-diff` | Change detection is structural: deep equality per leaf (arrays are leaves), notification of each changed leaf plus every ancestor and the root, none when nothing changed; `_`-prefixed top-level keys are excluded. |
| `§leaf-binding` | The view binds only `input` / `select` / `textarea` / `output` elements carrying `data-path`; `updateFieldValue()` never targets a component host and skips controls with `data-editing`. |
| `§patch-helper` | All client PATCHes go through `api.patchCharacter(id, updates)`; no hand-rolled `fetch` + auth headers in components or behaviors. |

## Consequences

### Positive

- Components react to their own PATCH result and to SSE with one declared
  dependency list; the "component reflects derived values" acceptance
  criteria of the catalog pickers become achievable.
- Cleanup is guaranteed by the platform: navigating away disconnects every
  host, which releases its subscriptions and behaviors. No manual
  `_unsubscribe` bookkeeping.
- No spurious work: the SSE echo of a client's own PATCH is a no-op; leaf
  flashes (`.updated`) fire only on real changes.
- The pure diff gives the project its first `node:test` coverage of client
  code without a DOM environment.
- The `render(character)` argument rule is the create-mode seam the roadmap
  already asks for, at zero additional cost now.

### Negative / costs

- The five existing components are rewritten as classes; the port is
  mechanical (bodies move into `render`) but touches every component module,
  the registry, the renderer (one argument), `state.mjs`, `character-view.mjs`
  and `editable.mjs`.
- Custom-element hosts add one wrapper element per component in the DOM.
  `display: contents` keeps layout unchanged, but selectors such as
  `section > section#portrait` must be re-checked at port time.
- Components that rebuild children lose transient DOM state (an open
  `<select>`) when their data **actually** changes. Acceptable: a real change
  from another client should be visible immediately; components that need
  finer control patch in place instead.

### Neutral

- Native leaf controls keep today's fine-grained `updateFieldValue()` path;
  the schema-driven form renderer is untouched apart from passing `data`.
- ADR-009's rendering model, section registry and schema `ui` metadata are
  unchanged.

## References

- [ADR-005](005-sse-realtime.md)
- [ADR-009](009-schema-driven-rendering.md)
- [ADR-012](012-standards-first-html-css.md)
- [architecture.md §4.3](../architecture.md)
