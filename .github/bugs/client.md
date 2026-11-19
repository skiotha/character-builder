# Bug Tracker — Browser client (open)

> Open bugs in the SPA under `public/`: router, views, component elements,
> client state. Resolved client bugs are archived in
> [`resolved.md`](resolved.md); engine bugs live in [`engine.md`](engine.md),
> API / infra bugs in [`infra.md`](infra.md).
>
> See [`README.md`](README.md) for the `NB-N` id scheme, the severity rubric,
> and the filing / closing procedure. Cite a bug from code as `NB-<n>`.

## MEDIUM — Address during current work

### NB-56. Client `DEFAULT_CHARACTER` still has the pre-Chunk-D shape and schema 1
- **Where:** `public/utils/rpg.mjs` `DEFAULT_CHARACTER` — `combat.weapons` with a scalar `attackAttribute`, empty `equipment.weapons`, `schemaVersion: 1`. The server's `generateDefaultCharacter` already seeds `natural_weapon` and schema 2.
- **Impact:** The creation view sources its form from this object, so a new character starts from a shape the server no longer produces. It blocks the weapon-slots renderer in creation mode and will surface as the catalog pickers (Chunk I) reach the creation flow.
- **Fix when scoped:** align with the Chunk-D shape (`combat: { carried }`, seed `equipment.weapons[0]` with `natural_weapon` from the catalog, `schemaVersion: 2`); ideally derive it from the server's default or schema so the two cannot drift again. Already described under the Chunk-D weapon-slots follow-up in `docs/roadmap.md`; this entry gives it a citable id.
- **Status:** ⚠️ Open — noticed 2026-11-19 during a read-only project review.

## LOW — Fix opportunistically

### NB-52. Router drops a hash change that arrives while a view is still loading
- **Where:** `public/router.mjs` `handleRoute` — the `isNavigating` re-entrancy guard returns early while `await route.view(...)` is pending, and nothing re-runs routing once the load settles.
- **Impact:** If the hash changes mid-load (back button pressed while the sheet is fetching, two quick `#home` / card clicks, a scripted `goto` racing the first render) the URL and the rendered view desync: the address bar shows the new route, the old one finishes rendering and stays. Reproduces only inside the fetch window, so it is rare in practice.
- **Fix when scoped:** replace the boolean guard with a navigation token — record the target hash on entry, and after `await route.view(...)` compare it with `location.hash`; if they differ, route again for the current hash (one trailing re-run is enough, the in-flight view's cleanup is returned and called like any other). Alternatively abort the in-flight load via `AbortSignal` passed to the view.
- **Status:** ⚠️ Open — surfaced 2026-09-16 while making the router hash-driven (ADR-017 teardown work); guard kept as-is there because the leak gate does not exercise the race.
### NB-53. Dashboard cards without a portrait show a broken image
- **Where:** `public/components/character-card.mjs` `renderPortrait` — the no-portrait branch creates an `<img>` with `alt="Default portrait"` and size attributes but no `src`.
- **Impact:** Every character without an uploaded portrait renders as a broken image with its alt text showing on the dashboard card. Cosmetic; screen readers announce a "Default portrait" that is not there.
- **Fix when scoped:** render a real placeholder (a decor asset per DS §assets, or a CSS-drawn frame with an empty `alt`), or omit the `<img>` and let the `<picture>` style the empty state.
- **Status:** ⚠️ Open — noticed 2026-11 during the catalog-picker browser checks; outside that work, left as-is.

### NB-54. Home link is announced as "Ahani home icon"
- **Where:** `public/index.html` header — `<svg role="img" aria-label="Ahani home icon">` inside `a#home`, a leftover from the Ahani site.
- **Impact:** The link's accessible name names another project and describes the icon rather than the destination.
- **Fix when scoped:** name the link by its purpose (e.g. `aria-label="Dashboard"` on the `<a>`, the SVG `aria-hidden="true"`), with the copy following the l10n pass.
- **Status:** ⚠️ Open — noticed 2026-11-17 while separating the Nagara and Ahani Figma files.

### NB-55. SPA fallback keeps an invalid pathname when navigating to a hash route
- **Where:** `src/app.mts` `serveClient` serves the SPA for an unknown pathname; `public/router.mjs` `navigate` changes only `window.location.hash`, leaving that pathname intact.
- **Reproduction:** open a mistyped address such as `http://127.0.0.1:3000/randomstring`, then navigate to the dashboard. The resulting URL is `/randomstring#dashboard` rather than `/#dashboard`.
- **Impact:** The app may recover to a valid view, but the address bar, copied links and subsequent hash navigation retain the invalid path.
- **Expected / fix when scoped:** keep the permissive initial-page / dashboard fallback, but normalize the pathname to the application's root when recovering. Verify direct typo URLs, subsequent navigation, refresh and browser back/forward; do not rewrite legitimate static-file, API or dev-gallery URLs.
- **Status:** ⚠️ Open — reported by the user and reproduced 2026-11-17; recorded only, not fixed as part of the gallery work.

### NB-57. Unused no-op `sanitizeTextFields` stub in a misspelled file
- **Where:** `public/validation/sanitatization.mjs` — `sanitizeTextFields` returns a shallow copy and changes nothing; no module imports it.
- **Impact:** Dead code that suggests client-side text sanitization exists when it does not. The filename typo ("sanitatization") also hides it from searches for "sanitization".
- **Fix when scoped:** delete it, or rename it to `sanitization.mjs` and give it a real job if a client-side hook is still wanted. Server-side validation stays authoritative either way.
- **Status:** ⚠️ Open — noticed 2026-11-19 during a read-only project review.