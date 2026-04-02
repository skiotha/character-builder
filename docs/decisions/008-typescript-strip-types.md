# ADR-008: TypeScript via Node.js Strip-Types

**Status:** Accepted
**Date:** 2026-03-31
**Deciders:** Project owner + Copilot design session

## Context

The codebase is currently plain JavaScript (`.mjs` files) with no type annotations. The sibling projects (`mychar`, `malizia`) have adopted TypeScript with the following shared conventions:

- `.mts` file extension
- `tsconfig.json` with `noEmit: true`, `strict: true`, `verbatimModuleSyntax`
- Node.js 24+ `--experimental-strip-types` for direct execution (no tsc build)
- `@types/node` as the sole devDependency
- `tsc -p tsconfig.json` for type-checking only (no compilation step)

This gives full type safety without a build pipeline.

## Decision

Adopt the same TypeScript conventions as `mychar` and `malizia`.

### tsconfig.json

```jsonc
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "types": ["node"],
    "strict": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true,
  },
  "include": ["src/**/*", "config/**/*", "scripts/**/*", "test/**/*"],
  "exclude": ["node_modules"],
}
```

### package.json engine

```jsonc
{
  "engines": { "node": ">=24.0.0" },
}
```

### Scripts

```jsonc
{
  "scripts": {
    "start": "node src/server.mts",
    "start:dev": "node --env-file-if-exists=config/nagara.development.env scripts/watcher.mts",
    "typecheck": "tsc -p tsconfig.json",
    "test": "node --test test/**/*.test.mts",
  },
}
```

> **Note:** Type stripping became unflagged in Node 23.6.0 and is enabled
> by default in Node 24+. The `--experimental-strip-types` flag originally
> specified here is no longer needed with our `>=24.0.0` engine requirement.

### Migration Strategy

Files are renamed `.mjs` → `.mts` during the project restructure (ADR-006).
Types are added incrementally:

1. Leaf modules first (config, logger, auth, utils) — smallest surface area
2. Core interfaces defined early (`Character`, `CharacterIndex`, `Effect`, etc.)
3. Models and rules next — these benefit most from type safety
4. Handlers and routes last — they consume typed services

## Consequences

- **Positive:** Type safety catches bugs at development time. Especially valuable for the deeply-nested character schema.
- **Positive:** Consistent with sibling projects. Same tsconfig, same conventions, same mental model.
- **Positive:** No build step. Files execute directly via Node.js strip-types.
- **Positive:** IDE support (autocomplete, refactoring, inline errors) works immediately.
- **Negative:** ~~`--experimental-strip-types` is still flagged experimental in Node 24.~~ Resolved — unflagged since Node 23.6.0, default in Node 24+.
- **Negative:** Migration is a large mechanical diff across all files. Combining it with the restructure (ADR-006) minimizes the number of disruptive commits.
