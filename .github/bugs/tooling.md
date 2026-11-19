# Bug Tracker — Tooling & repository (open)

> Open bugs in the build, test and CI tooling and in repository metadata
> (`package.json`, `LICENSE`, `.github/workflows/`). Resolved ones are
> archived in [`resolved.md`](resolved.md); engine bugs live in
> [`engine.md`](engine.md), API / infra bugs in [`infra.md`](infra.md),
> client bugs in [`client.md`](client.md).
>
> See [`README.md`](README.md) for the `NB-N` id scheme, the severity rubric,
> and the filing / closing procedure. Cite a bug from code as `NB-<n>`.

## LOW — Fix opportunistically

### NB-58. Typecheck depends on a global `tsc`; CI runs neither typecheck nor tests
- **Where:** `package.json` — `"typecheck": "tsc -p tsconfig.json"`, but `typescript` is not a dependency (only `@types/node` is), so the script uses whatever `tsc` is installed globally (7.0.2 today). `.github/workflows/` holds only `codeql.yml` and `copilot-setup-steps.yml`.
- **Impact:** A fresh clone after `npm ci` cannot typecheck, and results can change with the global compiler version. Nothing gates a push on the 860-test suite or the typecheck.
- **Fix when scoped:** pin `typescript` as a devDependency (the sanctioned dev-only exception, as with `@types/node`), then add a workflow running `npm ci`, `npm run typecheck` and `npm test` on Node 26. The CI half is already planned in Phase 8 of `docs/roadmap.md`.
- **Status:** ⚠️ Open — noticed 2026-11-19 during a read-only project review.

### NB-59. Package metadata still names the Ahani project
- **Where:** `package.json` `author.name` is `"ahani"`; `LICENSE` reads "Copyright (c) 2026 Aha". Both carried over from the split out of `ahani-server`.
- **Impact:** Cosmetic, but the published license and package metadata name a different project than Nagara. The client-side twin of this leftover is NB-54.
- **Fix when scoped:** set the author and the copyright holder to the intended name.
- **Status:** ⚠️ Open — noticed 2026-11-19 during a read-only project review.