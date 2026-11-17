# Bug Tracker — Browser client (open)

> Open bugs in the SPA under `public/`: router, views, component elements,
> client state. Resolved client bugs are archived in
> [`resolved.md`](resolved.md); engine bugs live in [`engine.md`](engine.md),
> API / infra bugs in [`infra.md`](infra.md).
>
> See [`README.md`](README.md) for the `NB-N` id scheme, the severity rubric,
> and the filing / closing procedure. Cite a bug from code as `NB-<n>`.

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
