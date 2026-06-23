---
applyTo: "**/*.ts, **/*.mts"
---

# TypeScript instructions

- Use `.mts` extension for all server files
- Use explicit type annotations on function parameters and return types
- Define interfaces for data shapes (prefer `interface` over `type` for objects)
- Use `import type` for type-only imports (`verbatimModuleSyntax` enforced)
- Use Node.js subpath imports (`#config`, `#logger`, `#models`, `#types`, etc.)
- Use `#models/*` wildcard for direct model sub-module access (e.g. `#models/storage`)
- Do not use `any` — use `unknown` and narrow

## Documentation

- Non-trivial `.mts` modules (rules engine, models, multi-step routes) carry a top-of-file **module header** documenting the module's purpose, where it sits in the larger flow, and any cross-cutting invariants. [`src/rules/derived.mts`](../../src/rules/derived.mts) (its numbered pipeline overview) is the reference shape — keep it current when the flow changes.
- The general three-scale comment ladder and citation discipline live in [`conventions.instructions.md`](conventions.instructions.md).