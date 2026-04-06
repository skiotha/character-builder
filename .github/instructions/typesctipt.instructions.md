---
applyTo: "**/*.ts, **/*.mts"
---

### TypeScript

- Use `.mts` extension for all server files
- Use explicit type annotations on function parameters and return types
- Define interfaces for data shapes (prefer `interface` over `type` for objects)
- Use `import type` for type-only imports (`verbatimModuleSyntax` enforced)
- Use Node.js subpath imports (`#config`, `#logger`, `#models`, `#types`, etc.)
- Use `#models/*` wildcard for direct model sub-module access (e.g. `#models/storage`)
- Do not use `any` — use `unknown` and narrow