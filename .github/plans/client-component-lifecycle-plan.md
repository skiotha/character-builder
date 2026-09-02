# Plan — Client component lifecycle (custom elements + structural change detection)

**Status:** active (2026-09-02) — design locked with the user and recorded as
[ADR-017](../../docs/decisions/017-client-component-lifecycle.md); step 0
shipped. Blocks [`phase6-chunkI-plan.md`](./phase6-chunkI-plan.md) step 1.
**Owner:** user (design authority) + agent (implementation)
**Session note:** every step from 1 on is executed in a fresh agent session
with no memory of this one — this file, ADR-017 and the **ui-navigation-
playbook** rule are the complete hand-off. Keep them current as steps land.
**Trigger:** The Chunk I step-1 readiness review (2026-09-02) showed that the
client has **no re-render contract for component overrides**, and that the
one update path it does have actively destroys them. Every catalog picker
Chunk I adds is a component whose "done when" requires reacting to its own
PATCH result and to SSE — so the contract has to exist first, and it should be
built once rather than improvised per component.

## Findings (verified in-browser, 2026-09-02)

- `bindFieldsToState` (`public/views/character-view.mjs`) subscribes **every**
  `[data-path]` element — native controls and component roots alike — to
  `updateFieldValue` (`public/utils/dom.mjs`), which treats any non-control as
  a text output (`el.textContent = value`).
- `notifyChangedPaths` (`public/state.mjs`) diffs a `flatten()` of old vs new
  character with `!==`. Arrays are leaves, and every response is fresh JSON,
  so every array path "changes" on every `setCurrentCharacter` — which runs
  **twice** per PATCH (own response + SSE echo).
- Observed result of one main-hand slot change (200 OK): `OL combat.carried`
  → `"[object Object],,[object Object]"` (3 selects gone), `UL traits` →
  `"[object Object]"`, `DIV equipment.weapons` stub likewise. Portrait
  survived only because objects flatten into leaves nobody subscribes to —
  i.e. the portrait component **never** updates on SSE either.
- Components read sibling data from global state at render time
  (`weapon-slots` needs `equipment.weapons`; the picker will need
  `combat.carried`) but there is no way to declare that dependency or to be
  re-rendered when it changes; no teardown hook exists for component-level
  listeners or subscriptions beyond the view's ad-hoc `_unsubscribe` sweep.
- Side effects in the same code path: an SSE update landing mid-edit
  overwrites the value the user is typing (`updateFieldValue` ignores
  `data-editing`); PATCH + auth headers are hand-rolled in `editable.mjs` and
  `weapon-slots.mjs` (the picker would be the third copy).

## Options weighed

| | Option | Verdict |
| --- | --- | --- |
| A | Guard `bindFieldsToState` to skip component roots | Stops the clobber; components then never update. Part of every option, insufficient alone. |
| B | Components self-subscribe and `replaceWith` themselves | Per-component boilerplate; replaced nodes lose their unsubscribe handle → leaks on view teardown; spurious rebuilds still close an open `<select>` mid-interaction. |
| C | Renderer-owned lifecycle: components return `{ el, update, destroy }`, the view wires subscriptions | Sound, but re-implements what the platform provides (instance registry, explicit destroy bookkeeping). Fallback if custom elements are rejected. |
| D | Rebuild the whole form on every state change | Destroys focus, in-progress inline edits, portrait pan-zoom, open dropdowns; a DOM-diff library would fix that but breaks the no-build / no-dependency client. |
| E | Fix the state layer: structural equality + ancestor-path notification | Required by B, C and F: no spurious notifications, SSE echo becomes a no-op, components subscribe to subtree roots. |
| **F** | **Light-DOM custom elements** with a small base class: `connectedCallback` subscribes, `disconnectedCallback` unsubscribes, `render(character)` rebuilds | Lifecycle + cleanup come from the platform (ADR-012: prefer native Web APIs). Teardown is automatic when the router swaps views. Declared deps, whole-character access, create-mode seam for free. **Chosen, with E.** |

## Design (locked 2026-09-02 — normative text lives in ADR-017)

The items below are the working summary; where they and ADR-017 disagree,
ADR-017 wins and this list gets corrected.

1. **Component overrides are light-DOM custom elements** named `nagara-*`
   (`<nagara-weapon-slots>`, `<nagara-trait-list>`, …). **No shadow DOM** —
   the `@layer` / `@scope` stylesheets and native widgets inside keep
   working unchanged. Hosts render `display: contents` so they are
   layout-transparent; inner markup stays what each component renders today
   (`ol.weapon-slots`, `section#portrait`, `div#character-name`) so existing
   CSS selectors are untouched (styling is Chunk I step 5's job).
2. **Base class `NagaraElement`** (`public/components/base.mjs`):
   - properties set by the factory: `path`, `fieldSchema`, `role`, `mode`,
     `character` (initial data);
   - `static deps = []` — subtree roots the element re-renders on
     (e.g. `["combat.carried", "equipment.weapons"]`);
   - `connectedCallback()` — in `view` mode subscribe to each dep, then
     `render(this.character ?? getState().currentCharacter)`;
   - `disconnectedCallback()` — unsubscribe, `cleanupBehaviors(this)`;
   - `update()` — coalesces multiple dep notifications from one
     `setCurrentCharacter` into a single `render` via `queueMicrotask`;
   - `render(character)` — abstract; rebuilds children **or patches in
     place** (portrait must patch: `portraitHandler.mjs` holds DOM refs), then
     `enhanceElement(this)` for any `data-behavior` it emitted. Components
     never read global state inside `render` — data arrives as the argument,
     which is what makes create mode possible later.
3. **Registry contract widens by one argument**: `getComponent(name)` still
   returns `(path, fieldSchema, value, role, mode, data) → HTMLElement`; the
   renderer passes the full `data` it already has (one-line change in
   `section-renderer.mjs`). Each component module exports a factory that
   creates its element, assigns the props, and returns it; `customElements.
   define` runs at module import. Stubs stay plain `<div>`s (they are
   replaced by Chunk I).
4. **State layer** (`public/state.mjs` + new `public/utils/diff.mjs`):
   `changedPaths(oldChar, newChar)` returns leaf paths whose values differ
   **structurally** (`deepEqual` over JSON values; arrays remain leaves for
   diffing), plus every ancestor path and the root `""`. `notify` runs once
   per changed path. `subscribeCharacter(cb)` is sugar for the root. The
   pure diff lives in a DOM-free module so it gets the project's first
   `node:test` coverage of client code (`test/client-diff.test.mts`, importing
   the `.mjs` directly; add a declaration shim if `tsc` objects — `tsconfig`
   includes only `src/ config/ scripts/ test/`). **Transport keys:** `_`-
   prefixed top-level keys are excluded from the diff — `_permissions` is
   attached only by `GET /characters/:id` (`handleGetCharacter.mts`); PATCH
   responses and SSE payloads omit it, so without the exclusion every PATCH
   would look like a `_permissions.*` change and drop the key from state.
   Keep the previously stored `_permissions` when the incoming character
   lacks it.
5. **Leaf binding narrows**: `bindFieldsToState` / `detachCharacterViewListeners`
   bind only `input, select, textarea, output` carrying `data-path`.
   `updateFieldValue` skips an element that has `data-editing` (the save
   flow's own PATCH response brings the latest value after blur).
6. **Shared PATCH helper**: `api.patchCharacter(id, updates)` builds the
   auth headers once and returns the parsed body; `editable.mjs`,
   `weapon-slots`, and every Chunk I picker use it. Error surfacing stays
   `console.error` (user-facing errors are a roadmap Phase 8 item).
7. **Create mode ships no reactivity here** (Chunk I decision 5 stands):
   elements with `mode === "create"` skip state subscriptions and render
   once from the `character` prop the renderer supplied. The seam for later
   (Phase 8 preview endpoint) is "the form calls `el.render(localData)`" —
   nothing to build now, but nothing in this contract precludes it.
8. **ADR-017 — Client component lifecycle** (written in step 0). Records:
   custom elements without shadow DOM, the base-class contract, structural
   change detection with ancestor notification, the native-controls-only
   binding rule, the shared PATCH helper, and the amendment to ADR-009's
   consequence that "the existing state system works unchanged" (true for
   leaf fields, false for components). Stable anchors: `§light-dom`,
   `§deps`, `§render-arg`, `§structural-diff`, `§leaf-binding`,
   `§patch-helper` — cite these from code, never this plan.
9. **Portrait upload in view mode comes along** (user call, 2026-09-02):
   today `initPortraitUpload` is wired only by `creation-view.mjs`, so the
   sheet's portrait is display-only. Once `<nagara-portrait>` owns the
   handler wiring in `connectedCallback`, enabling it in view mode is the
   same code path — do it in step 3, gated on `role` write permission for
   `portrait`. The upload endpoint and crop PATCH already exist server-side;
   verify the handler's PATCH goes through `api.patchCharacter`.

## Goals

1. A component override re-renders when any of its declared dependencies
   changes — after its own PATCH and after SSE — and is never overwritten by
   the leaf-field update path.
2. Teardown is automatic and leak-free: navigating away from the sheet
   releases every component subscription and behavior.
3. No spurious work: identical data (the SSE echo of an own PATCH) produces
   no notifications, so open dropdowns and focus survive.
4. Existing behavior of the five current components (portrait, trait-list,
   talent-list, character-name, weapon-slots) is preserved in both views.

## Non-goals

- Create-mode reactivity / effect-aware previews (roadmap Phase 8 preview
  endpoint).
- Any picker functionality (Chunk I resumes on top of this plan).
- Styling changes (Chunk I step 5); user-facing error UI (Phase 8).
- Shadow DOM, form-associated custom elements, or customized built-ins
  (`is=`) — not needed and `is=` lacks Safari support.

## Steps

Each step is its own commit + confirmation stop. Gates: `npm run typecheck`
+ `npm test` green, and an in-browser pass over the touched surface
(Playwright, per the **ui-browser-verify** rule).

**Fixture recipe** (the **ui-navigation-playbook** rule has the same recipe
under "Seeding a fixture via the API"; this copy is the step-gate checklist):

1. `npm run start:dev` → `http://127.0.0.1:3000`. `data/` is gitignored, so
   assume no characters exist.
2. `POST /api/v1/characters` with header `x-player-id: <token>` and the
   **full** required payload — `characterName`, `background.{race,age}`,
   `attributes.primary.*` (×8, sum 80), `attributes.secondary` (`toughness.
   {max,current}`, `defense`, `armor`, `painThreshold`,
   `corruptionThreshold`, `corruptionMax`), `experience.{total,unspent}`,
   `corruption.{permanent,temporary}`, `equipment.money`. Omitting any of
   these is a 400 with `REQUIRED` details.
3. `PATCH /api/v1/characters/:id` (same header) with `updates: […]`:
   `equipment.weapons` → keep `natural_weapon` at index 0, add
   `two_handed_sword` (heavy, 10, `["precise","versatile"]`) and
   `war_claws` (natural, 4, `["own","short","deep_wounds"]`); `traits` →
   `[{ id: "polearm", tier: "novice", source: "ability" }]` (the id is
   `polearm`, not `polearm-mastery`). Entry shape: `id`, `name`, `type`,
   `damage`, `qualities`.
4. In the browser: `localStorage.setItem("x-player-id", "<token>")`, then
   load `/#character/<id>` and **reload once** (the hash route does not
   re-render on a same-document hash change from `page.goto`). The form
   should report `data-role="owner"`.
5. Instrumentation that worked: a `MutationObserver` on every `[data-path]`
   element watching the `class` attribute for the `updated` flash gives the
   exact set of elements a state set touched; `page.selectOption` on
   `[data-path="combat.carried"] select[data-slot="0"]` triggers a real
   PATCH. Regression probe: no `[data-path]` element's `textContent`
   contains `[object Object]`.

- **Step 0 — Decision lock + ADR-017.** Confirm the design items above with
  the user; write `docs/decisions/017-client-component-lifecycle.md` with its
  Stable-anchors table; add it to `docs/decisions/README.md`; note the
  amendment in ADR-009's Consequences. Roadmap: Phase 6 status blockquote
  gains this plan; Chunk I row → paused with a pointer here.
  **Done when:** `npm test` green (anchor lints), ADR index updated.
  > ✅ Completed 2026-09-02. Also landed: `docs/architecture.md` §4.3 note,
  > ADR-017 bullet in `.github/copilot-instructions.md` + `AGENTS.md`,
  > playbook mirrors gained "Seeding a fixture via the API" and the interim
  > clobber quirk, portrait view-mode upload folded into step 3 (design
  > item 9).
- **Step 1 — Structural change detection.** New `public/utils/diff.mjs`
  (`deepEqual`, `changedPaths` with ancestor bubbling); `state.mjs` uses it
  and gains `subscribeCharacter`; `test/client-diff.test.mts` covers
  primitive / array / nested-object changes, ancestor set, unchanged →
  empty. Leaf binding narrows to native controls; `updateFieldValue` skips
  `data-editing`. `api.patchCharacter` added and adopted by `editable.mjs`.
  **Done when:** in-browser: change main-hand slot → the three previously
  clobbered elements keep their children (weapon-slots is still stale at
  this step — that is expected); inline-edit Location while a PATCH from a
  second tab lands → typed value survives until blur.
- **Step 2 — Base element + first port (weapon-slots).** `base.mjs`;
  registry / renderer pass `data`; `weapon-slots` becomes
  `<nagara-weapon-slots>` with `deps = ["combat.carried",
  "equipment.weapons"]`, uses `api.patchCharacter`, sends the stripped
  `{ weaponIndex }` tuple as today.
  **Done when:** in-browser: change main-hand → derived Attack / Base damage
  update from the PATCH response; SSE echo triggers no second render
  (instrument with a counter or the `updated` flash); a second tab's slot
  change updates this tab's dropdowns; open off-hand dropdown is not closed
  by an unrelated SSE update.
- **Step 3 — Port the remaining components.** `trait-list`, `talent-list`
  (rebuild; keep the lazy trait-library enrichment), `character-name`
  (in-place `value` patch, respects `data-editing`), `portrait` (in-place
  `src` / transform patch; element owns `initPortraitUpload` wiring via
  `connectedCallback` / `disconnectedCallback` in **both** modes — replacing
  `portraitManager` in `creation-view.mjs` and enabling upload on the sheet
  for roles with `portrait` write permission, design item 9). Add the
  `display: contents` host rule.
  **Done when:** in-browser: creation flow unchanged end-to-end (portrait
  upload + crop + submit); on the sheet, owner uploads a portrait and a
  second tab shows it via SSE; a trait PATCHed from a second tab appears
  live; character name SSE update lands unless editing.
- **Step 4 — Teardown + leak check.** Navigate sheet → dashboard → sheet
  three times, then PATCH once: every affected element flashes exactly once
  (no duplicate subscriptions); `disconnectedCallback` observed for each
  host on navigation (temporary console instrumentation, removed before
  commit). Remove the now-dead `_unsubscribe` sweep if nothing uses it.
  **Done when:** counts match; `npm test` green.
- **Step 5 — Docs & bookkeeping.** `docs/architecture.md` §4.3 redrawn to
  the as-built two update paths (replacing the interim note);
  **ui-navigation-playbook** mirrors (`.github/instructions/` +
  `.cursor/rules/`) — retire the interim clobber quirk, keep the fixture
  recipe; `.github/copilot-instructions.md` + `AGENTS.md` ADR-017 bullet
  checked against the as-built contract; repo memory refreshed; Chunk I plan
  unblocked (status back to active, step 1 rewritten to target
  `NagaraElement`); sweep the references list.
  **Done when:** all bookkeeping in one commit; Chunk I step 1 can start.

## Verification

- `npm run typecheck` clean; `npm test` green at every step (including the
  new `test/client-diff.test.mts`).
- Per-step in-browser gates above. Regression probe for the original
  defect: after any PATCH, no `[data-path]` element's `textContent`
  contains `[object Object]`.
- No server behavior change — `test/data-contracts.test.mts` untouched.

## References to sweep on completion

Every code-side `TODO(<scope>)` that cites this plan is listed here, so the
cleanup obligation is "follow this checklist", not "remember to grep".

- _(none yet)_

## Progress

- [x] Step 0 — Decision lock + ADR-017 (2026-09-02)
- [ ] Step 1 — Structural change detection
- [ ] Step 2 — Base element + first port (weapon-slots)
- [ ] Step 3 — Port the remaining components
- [ ] Step 4 — Teardown + leak check
- [ ] Step 5 — Docs & bookkeeping
