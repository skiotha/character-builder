# Plan — Client component lifecycle (custom elements + structural change detection)

> **Status:** ✅ Done — archived 2026-09-16. All five steps shipped; the
> normative contract is [ADR-017](../../../docs/decisions/017-client-component-lifecycle.md)
> and the as-built flow is `docs/architecture.md` §4.3. This file is kept
> for the per-step divergence notes and the fixture / instrumentation recipe
> (also in the **ui-navigation-playbook** rule). Unblocked
> [`phase6-chunkI-plan.md`](../phase6-chunkI-plan.md) step 1.

**Original status:** active (2026-09-02) — design locked with the user and
recorded as ADR-017. Blocked `phase6-chunkI-plan.md` step 1.
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
   load `/#character/<id>`. Before step 4 a same-document hash change from
   `page.goto` did not re-render (reload once); since step 4 the router
   listens to `hashchange`, so it does. The form should report
   `data-role="owner"`.
5. Instrumentation that worked: a `MutationObserver` on every `[data-path]`
   element watching the `class` attribute for the `updated` flash gives the
   exact set of elements a state set touched; `page.selectOption` on
   `[data-path="combat.carried"] select[data-slot="0"]` triggers a real
   PATCH. Host lifecycle counts without touching source: in
   `page.evaluate`, wrap `render` on each `customElements.get("nagara-*").
   prototype` — that works because `render` is looked up dynamically.
   Wrapping `connectedCallback` / `disconnectedCallback` on the base
   prototype does **not**: custom-element reactions are captured at
   `customElements.define` time, so only subclasses that call
   `super.connectedCallback()` (portrait) hit the wrapper. Assert teardown
   through DOM + behaviour instead: zero `nagara-*` hosts after leaving, and
   `setCurrentCharacter(<sheet snapshot>)` on the dashboard producing zero
   `render` calls (proves the dep subscriptions were released). Regression
   probe: no `[data-path]` element's `textContent` contains
   `[object Object]`.

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
  > ✅ Completed 2026-09-04. Divergences from the outline: `tsconfig`
  > gained `"allowJs": true` instead of a `.d.mts` shim (the `include` list
  > is unchanged, so only test-imported `.mjs` files enter the program);
  > `api.patchCharacter(id, updates, { signal })` accepts an abort signal and
  > resolves with the parsed body on **any** HTTP status (callers branch on
  > `success`; network / abort errors propagate, no logging in the helper);
  > root subscribers receive `(character, "", character)`; the `_permissions`
  > carry-over is guarded by `old.id === incoming.id`; a subtree that appears,
  > vanishes or is replaced by a primitive reports its leaves (so leaf
  > subscribers beneath it fire); `public/utils/flatten.mjs` deleted (dead).
  > In-browser: `Location` sits in a hidden section, so the mid-edit gate was
  > run on `background.race` — same `edit-enabled` path.
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
  > ✅ Completed 2026-09-10. Divergences from the outline: `base.mjs` also
  > exports `componentFactory(ElementClass)` (builds the six-argument
  > registry factory, assigns props + host `data-path`) and gives
  > `NagaraElement` a `rebuild(...nodes)` helper (`cleanupBehaviors` →
  > `replaceChildren` → `enhanceElement`); `update()` refreshes
  > `this.character` from state before calling `render`. The
  > `display: contents` host rule landed here (in `@layer reset`, one
  > selector — step 3 extends the list) rather than in step 3. `data-path`
  > sits on the host only; the inner `ol.weapon-slots` no longer carries it.
  > `character-view.mjs` now calls `setCurrentCharacter` **before** building
  > the form, so hosts subscribing in `connectedCallback` see no diff and
  > render exactly once on load. Gate note: per-slot derived fields live
  > inside `combat.carried`, so the "unrelated SSE update" check must use a
  > field outside the deps (run on `background.race`: 0 renders, focused
  > off-hand `<select>` kept identity and focus). Create-mode host verified
  > via the CTA (`#character/new` on reload is routed as an id by `app.mjs`
  > — pre-existing).
- **Step 3 — Port the remaining components.** `trait-list`, `talent-list`
  (rebuild; keep the lazy trait-library enrichment), `character-name`
  (in-place `value` patch, respects `data-editing`), `portrait` (in-place
  `src` / transform patch; element owns `initPortraitUpload` wiring via
  `connectedCallback` / `disconnectedCallback` in **both** modes — replacing
  `portraitManager` in `creation-view.mjs` and enabling upload on the sheet
  for roles with `portrait` write permission, design item 9). Extend the
  `display: contents` host selector list to every `nagara-*` host.
  **Done when:** in-browser: creation flow unchanged end-to-end (portrait
  upload + crop + submit); on the sheet, owner uploads a portrait and a
  second tab shows it via SSE; a trait PATCHed from a second tab appears
  live; character name SSE update lands unless editing.
  > ✅ Completed 2026-09-11. Divergences from the outline:
  > - **Crop PATCH shape.** The plan assumed a client-side crop PATCH already
  >   existed; it did not (crop rode only in the create POST). The
  >   `portrait.crop` schema node carries no `permissions`, so a wholesale
  >   `portrait.crop` write is rejected (422 verified). `<nagara-portrait>`
  >   therefore PATCHes **six leaves** (`portrait.crop.{x,y,scale,rotation}`,
  >   `portrait.dimensions.{width,height}`) after upload and on every settled
  >   pan / wheel gesture (300 ms debounce, `AbortController` supersedes the
  >   in-flight PATCH). Upload goes through a new shared `api.uploadPortrait`
  >   (multipart POST; the hand-rolled copy in `creation-view.mjs` is gone).
  > - **Portrait local-session guard.** Once a file is picked in a connection
  >   the element skips incoming renders (`#editing`) so the server echo does
  >   not fight the blob preview; the session ends on disconnect. The
  >   handler (`portraitHandler.mjs`) now takes the host + `{ onFileReady,
  >   onCropChange }` callbacks, does no network I/O, and `cleanup()` removes
  >   every listener it adds. Re-cropping an already-saved portrait without a
  >   re-upload is deferred (`TODO(portrait-recrop)` → Chunk I step 4½).
  > - **`character-name` has `deps = []`.** Its inner `<input data-path>` is
  >   the one component descendant the view's leaf binding owns, so SSE /
  >   PATCH echoes land via `updateFieldValue()` (which honours
  >   `data-editing`); an element-level subscription would only race it. It
  >   also now sets `data-role-allowed` — `initEditable()` bails without it,
  >   so the banner input had never actually been editable on the sheet.
  > - **Behaviors.** `enhanceElement` / `cleanupBehaviors` skip elements
  >   inside a nested `nagara-*` host (hosts own their subtree), and the
  >   pre-existing double-init (each init function ran twice) is fixed;
  >   `initEditable` returns its cleanup instead of stashing it on the node.
  > - **Shared `isWritable(fieldSchema, role, mode)`** exported from
  >   `base.mjs` replaces the four per-component copies (weapon-slots adopted
  >   it too). Registry and export names unchanged.
  > Gate: creation E2E (POST 201 → portrait POST 200 → sheet shows the
  > upload), sheet upload = exactly one POST + one six-leaf PATCH, second tab
  > received new `src` + transform via SSE; drag → 1 PATCH, two quick wheel
  > ticks → 1 PATCH; traits / talents PATCHed via API re-rendered once each
  > (trait names enriched); remote rename skipped while `data-editing`,
  > landed otherwise; public role: file input `disabled`, no add slots, no
  > `edit-enabled`; navigate away → hosts gone, handler released, no console
  > errors; no `[object Object]` anywhere. Drop zone measured 30rem×45rem on
  > both routes, so stored crops reproduce — but the pan / zoom math itself
  > is wrong (user-reported; folded into Chunk I step 4½).
- **Step 4 — Teardown + leak check (scope expanded 2026-09-16).** The
  readiness review found the gate could not be driven as written: the sheet
  has **no path back to the dashboard** (nav links are `href="#"`
  placeholders, the header `#home` is an `<a>` without `href` nested in a
  `<button>`, and the router has no `hashchange` listener, so the back
  button is inert too), and `state.currentCharacter` is never cleared on
  leaving the sheet. Both are fixed here rather than worked around:
  - **Router becomes hash-driven** (`public/router.mjs`): `init(root)`
    installs one `hashchange` → `handleRoute()` listener; `navigate(path)`
    sets the hash and lets the event route (calls `handleRoute()` directly
    only when the hash is already equal — the initial-load path from
    `app.mjs`); the unused `data` parameter is dropped; an unmatched hash
    falls through the normal cleanup path to the `""` route; `route.auth`
    is finally enforced (no player token and not DM → `""` route);
    `character/:id` flips to `auth: false` (public-role viewing is a
    verified feature, step 3 gate).
  - **Header `#home`** (`index.html` + `styles.css`) becomes
    `<a id="home" href="#dashboard">` — the visible back control on the
    sheet and the creation form. `createViewNav` drops `href="#"` from
    BIO / INVENTORY / DESCRIPTION (inert placeholder hyperlinks) so they no
    longer route to the welcome view once `hashchange` is live.
  - **Sheet cleanup owns its teardown** (`character-view.mjs`), in this
    order: release leaf unsubscribes (closure-local array returned by
    `bindFieldsToState`; the `field._unsubscribe` expando and
    `detachCharacterViewListeners` go) → `cleanupBehaviors(container)` →
    `container.replaceChildren()` (hosts hit `disconnectedCallback` **here**,
    deterministically — the earlier note that it fires in the next view is
    retired) → `sse.disconnectCharacterStream()` →
    `setCurrentCharacter(null)` → `setPlayerRole("public")`. Late PATCH
    responses (`weapon-slots`, `editable`) check `isConnected` before
    `setCurrentCharacter`, so a response landing after navigation cannot
    re-populate the cleared state.
  - **Leak gate**, instrumented from Playwright with **no source edits**:
    wrap `render` on each `customElements.get("nagara-*").prototype` and
    `connectedCallback` / `disconnectedCallback` on the shared base
    prototype, plus the `updated`-flash `MutationObserver` from fixture
    item 5. Click `#home` → dashboard → card → sheet three times, then
    PATCH main-hand once: `weapon-slots` renders exactly once, the other
    hosts zero, each affected leaf flashes once; `disconnectedCallback`
    count equals host count per departure; `currentCharacter === null` on
    the dashboard; exactly one live `/stream`; back / forward re-render;
    welcome-page `#home` stays on welcome without an error block; nav
    placeholders do nothing; creation form still submits.
  **Done when:** counts match; `npm run typecheck` + `npm test` green.
  > ✅ Completed 2026-09-16. Gate driven end to end (718 tests, typecheck
  > clean): welcome `#home` without a token re-renders welcome (no error
  > block, hash stays `#dashboard`); sheet → `#home` → dashboard → VIEW →
  > sheet ×3 — zero hosts and `currentCharacter === null` on every
  > dashboard visit, five hosts and one live `/stream` on every sheet, zero
  > live streams on the dashboard; main-hand `selectOption` → `weapon-slots`
  > renders once, other hosts zero, no leaf flashes (the swap changes no
  > native leaf); replaying the sheet snapshot into state from the
  > dashboard produces zero renders (subscriptions released); back / forward
  > re-render; nav placeholders inert on both routes; creation form POST
  > 201 → new sheet as owner; a PATCH whose response lands after `#home`
  > leaves `currentCharacter` null (`isConnected` guard). Divergences:
  > `app.mjs` `handleHashRoute` now routes a hard-loaded `#character/new`
  > to the creation view instead of fetching a character named "new";
  > `character-view.mjs` cleanup also drops the container `id` (initial /
  > dashboard / creation already did) and the error path returns a
  > state-clearing cleanup too; the `disconnectedCallback`-count check was
  > replaced by the DOM + zero-render probe (fixture item 5 explains why);
  > the mid-load hash drop (`isNavigating`) is filed as NB-52 in the new
  > `.github/bugs/client.md` tracker, and the welcome-page `#home`
  > self-link is parked in `ux-wishlist.md` (Figma shows it there).
- **Step 5 — Docs & bookkeeping.** `docs/architecture.md` §4.3 redrawn to
  the as-built two update paths (replacing the interim note);
  **ui-navigation-playbook** mirrors (`.github/instructions/` +
  `.cursor/rules/`) — retire the interim clobber quirk and the "reload
  once" hash-route quirk (step 4 made the router hash-driven), document
  `#home` as the way back to the dashboard, keep the fixture recipe;
  `.github/copilot-instructions.md` + `AGENTS.md` ADR-017 bullet
  checked against the as-built contract; repo memory refreshed; Chunk I plan
  unblocked (status back to active, step 1 rewritten to target
  `NagaraElement`); sweep the references list.
  **Done when:** all bookkeeping in one commit; Chunk I step 1 can start.
  > ✅ Completed 2026-09-16. `docs/architecture.md` §4.3 redrawn (two update
  > paths, load order, teardown); ADR-017 §6 gained `api.uploadPortrait` as
  > the second transport helper (as-built amendment); the ADR-017 bullet in
  > `.github/copilot-instructions.md` + `AGENTS.md` now lists
  > `componentFactory` / `isWritable` / `rebuild` / the `isConnected` guard
  > and drops the pointer to this plan (plans are ephemeral — ADR-017 is the
  > sole stable authority). Playbook mirrors: clobber quirk and "reload once"
  > retired, stale `#home` `type=submit` note corrected, new "Routing &
  > getting around" section (`#home` → `#dashboard`, inert nav placeholders,
  > auth fallback, NB-52), instrumentation recipe from fixture item 5 moved
  > into the seeding section. Chunk I plan: status active, readiness-review
  > bullet marked resolved, step 1 fully rewritten against `NagaraElement`
  > (deps, `componentFactory`, `rebuild`, `isWritable`, `api.getWeapons`,
  > atomic re-map PATCH, `isConnected` guard). Roadmap Chunk I row → in
  > progress. Repo memory refreshed. Sweep list below verified empty.

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

- _(none)_ — verified at close-out (2026-09-16): the only `TODO(<scope>)`
  under `public/` is `TODO(portrait-recrop)`, which cites the Chunk I plan,
  not this one.

## Progress

- [x] Step 0 — Decision lock + ADR-017 (2026-09-02)
- [x] Step 1 — Structural change detection (2026-09-04)
- [x] Step 2 — Base element + first port (weapon-slots) (2026-09-10)
- [x] Step 3 — Port the remaining components (2026-09-11)
- [x] Step 4 — Teardown + leak check (2026-09-16)
- [x] Step 5 — Docs & bookkeeping (2026-09-16)
