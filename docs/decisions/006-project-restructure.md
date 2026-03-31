# ADR-006: Project Restructure

**Status:** Accepted
**Date:** 2026-03-31
**Deciders:** Project owner + Copilot design session

## Context

The project was extracted from a larger website (`ahani_server`) where the character builder lived under a `/nagara/c` subroute. The extraction left structural artifacts:

- `server/nagara/` — the actual application is nested two levels deep under a name that no longer serves a routing purpose.
- `server/data/` — runtime data (character files, uploads) lives inside the source tree.
- `client/` and `assets/` are siblings at the root, with no clear "public" boundary.
- Test files live inside `server/tests/` rather than at the project root.
- No TypeScript configuration or conventions.

The sibling projects (`mychar`, `malizia`) have already adopted a cleaner
structure: `src/` for server code, `config/` for environment, `test/` for
tests, `scripts/` for tooling.

## Decision

Restructure to the following layout:

```
character-builder/
├── src/                        ← server source (was server/nagara/)
│   ├── server.mts              ← HTTP bootstrap
│   ├── app.mts                 ← request handler composition
│   ├── lib/                    ← config, logger, auth, general utils
│   ├── middleware/
│   ├── routes/                 ← merged handlers + route wiring
│   ├── models/                 ← schema definition, storage, traversal
│   ├── rules/                  ← RPG rules engine
│   ├── renderers/
│   ├── templates/
│   └── sse/
├── public/                     ← static client files (was client/)
│   ├── index.html
│   ├── js/                     ← SPA modules
│   ├── css/                    ← styles
│   └── assets/                 ← fonts, icons, favicons (was top-level assets/)
├── data/                       ← runtime data (outside source, gitignored)
│   ├── characters/
│   ├── index.json
│   ├── uploads/
│   └── backups/
├── config/                     ← env files, path definitions
├── scripts/                    ← watcher, migrations, utilities
├── test/                       ← all tests, mirrors malizia structure
├── docs/                       ← architecture, contracts, decisions, roadmap
├── .github/
├── tsconfig.json
├── package.json
└── README.md
```

### Key Moves

| Before                          | After                         |
| ------------------------------- | ----------------------------- |
| `server/server.mjs`             | `src/server.mts`              |
| `server/config.mjs`             | `src/lib/config.mts`          |
| `server/logger.mjs`             | `src/lib/logger.mts`          |
| `server/router.mjs`             | `src/app.mts` + `src/routes/` |
| `server/nagara/auth.mjs`        | `src/lib/auth.mts`            |
| `server/nagara/utils.mjs`       | `src/lib/utils.mts`           |
| `server/nagara/storage.mjs`     | `src/models/storage.mts`      |
| `server/nagara/schema/*`        | `src/models/*`                |
| `server/nagara/handlers/*`      | `src/routes/*`                |
| `server/nagara/middleware/*`    | `src/middleware/*`            |
| `server/nagara/renderers/*`     | `src/renderers/*`             |
| `server/nagara/templates/*`     | `src/templates/*`             |
| `server/nagara/rules/*`         | `src/rules/*`                 |
| `server/nagara/sse.mjs`         | `src/sse/broadcast.mts`       |
| `server/nagara/routes/*`        | merged into `src/routes/*`    |
| `server/nagara/fileUploader`    | `src/lib/uploads.mts`         |
| `server/nagara/backup.mjs`      | `src/lib/backup.mts`          |
| `server/nagara/utils/multipart` | `src/lib/multipart.mts`       |
| `server/watcher.js`             | `scripts/watcher.mts`         |
| `server/data/`                  | `data/` (project root)        |
| `server/tests/`                 | `test/`                       |
| `client/`                       | `public/`                     |
| `assets/`                       | `public/assets/`              |

### Import Map Updates

`package.json` imports will be updated to reflect new paths:

```jsonc
{
  "imports": {
    "#config": "./src/lib/config.mts",
    "#logger": "./src/lib/logger.mts",
    "#auth": "./src/lib/auth.mts",
    "#models": "./src/models/index.mts",
    "#rules": "./src/rules/index.mts",
    "#middleware": "./src/middleware/index.mts",
    "#routes": "./src/routes/index.mts",
    "#sse": "./src/sse/broadcast.mts",
    "#http": "./src/lib/http-types.mts",
  },
}
```

## Consequences

- **Positive:** Professional, recognizable layout. Consistent with sibling projects.
- **Positive:** Runtime data (`data/`) is outside the source tree, making deploys cleaner and `.gitignore` simpler.
- **Positive:** Enables the TypeScript migration — files get renamed from `.mjs` to `.mts` during the move.
- **Negative:** All import paths change. This is a big, mechanical diff. Must be done in a single commit to avoid a broken intermediate state.
- **Negative:** Client import maps in `index.html` need updating to reflect the new `public/` structure.
