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
- **Status:** ⚠️ Open — surfaced 2026-09-16 while making the router hash-driven (lifecycle plan step 4); guard kept as-is there because the leak gate does not exercise the race.
