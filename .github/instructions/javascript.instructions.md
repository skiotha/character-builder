---
applyTo: "public/**/*.mjs"
---

# Client JavaScript instructions

Plain JavaScript with native ES modules — these files are the client SPA, served as-is with no build step.

- **Import ordering** — functions first, then constants, separated by a blank line (the server's import categories minus the `node:` tier).
- **Every exported function carries a JSDoc block with `@param` / `@returns`** — these are the only type signals. [`public/api.mjs`](../../public/api.mjs) is the reference shape; new client functions should match.
- The general three-scale comment ladder and citation discipline live in [`conventions.instructions.md`](conventions.instructions.md).

DOM / HTML / CSS concerns (semantic markup, native widgets, ADR-012) live in [`hypertext.instructions.md`](hypertext.instructions.md) and [`styling.instructions.md`](styling.instructions.md).
