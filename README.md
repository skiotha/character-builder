# Nagara Character Builder

Web application for creating and managing RPG characters in the Nagara
tabletop system. Canonical long-term store for character data; consumed by
two sibling projects:

- **addon** — World of Warcraft addon (Lua). Session-time consumer/editor.
- **malizia** — Discord bot (TypeScript). Rules lookup, dice, character refs.

## Stack

- **Runtime:** Node.js 24+ (native TypeScript via strip-types — no build step)
- **Server:** Raw `node:http` / `node:https`, zero npm runtime dependencies
- **Client:** Vanilla JavaScript SPA, native ES modules, schema-driven rendering
- **Storage:** File-based JSON (`data/characters/*.json` + `data/index.json`)
- **Real-time:** Server-Sent Events (per-character broadcast channels)
- **Tests:** `node:test` + `node:assert/strict`

See [docs/architecture.md](docs/architecture.md) for the full system overview
and [docs/roadmap.md](docs/roadmap.md) for phased work.

## Project Layout

```
src/         Server source (.mts)
public/      Client SPA (HTML, CSS, .mjs ES modules) — schema-driven
data/        Runtime, mutable, gitignored state
  characters/    One JSON file per character
  index.json     Lookup maps (byId, byBackupCode, byPlayer, all)
  backups/       Snapshot backups (DM-driven)
  uploads/       Portrait uploads
reference/   Authored canon — JSON catalogues consumed by the rules engine
             (abilities, spells, boons, sins, rituals, weapons, armor,
              runes — each per locale: .en.json / .ru.json)
             Lands here as part of Phase 6 — see roadmap.
rpg/         Authored canon — Obsidian Markdown vault, full free-form rules
             rpg/{locale}/01-core, 02-lore, 03-reference; rpg/_meta/
config/      Per-environment env files (gitignored, see below)
scripts/     Standalone tooling (watcher, etc.)
test/        Test suite (node:test)
docs/        Architecture, roadmap, ADRs, integration contracts
```

`data/` is runtime state and is gitignored. `reference/` and `rpg/` are
authored canon, committed to the repo.

## Quick Start

```powershell
# 1. Create the dev env file (gitignored)
New-Item -ItemType File config/nagara.development.env

# 2. Set at minimum the DM token
#    Add this line: NAGARA_DM_TOKEN=your-secret-token

# 3. Start in dev mode (auto-restart on crash, loads the env file)
npm run start:dev

# 4. Open http://localhost:3000
```

## Scripts

| Command               | Description                                    |
| --------------------- | ---------------------------------------------- |
| `npm start`           | Start the server directly                      |
| `npm run start:dev`   | Start with watcher + dev env file              |
| `npm run typecheck`   | TypeScript type-check (`tsc --noEmit`)         |
| `npm test`            | Run the test suite                             |

A bare `node src/server.mts` will not pick up `config/*.env` — use
`npm run start:dev`, or pass `--env-file=config/nagara.development.env`
explicitly.

## Environment Variables

Loaded from `config/nagara.{NODE_ENV}.env` (gitignored).

| Variable          | Required  | Default                                   | Description                                  |
| ----------------- | --------- | ----------------------------------------- | -------------------------------------------- |
| `NODE_ENV`        | No        | `development`                             | `development` or `production`                |
| `PORT`            | No        | `3000` (dev) / `443` (prod)               | Server port                                  |
| `LOCAL_ADDRESS`   | No        | `127.0.0.1` (dev) / `0.0.0.0` (prod)      | Bind address                                 |
| `NAGARA_DM_TOKEN` | Yes       | —                                         | Secret token for DM/admin access (ADR-003)   |
| `CORS_ORIGINS`    | Prod-rec. | (none)                                    | Comma-separated origin whitelist (ADR-007)   |
| `SSL_KEY`         | Prod      | —                                         | Path to SSL private key                      |
| `SSL_CERT`        | Prod      | —                                         | Path to SSL certificate                      |

## API

All API routes are under `/api/v1/`. The server is a pure JSON API; the
client renders all views from `(schema, data, role)` — see
[ADR-009](docs/decisions/009-schema-driven-rendering.md).

### Characters

- `GET    /api/v1/characters` — list (by player, or all for DM)
- `GET    /api/v1/characters/:id` — retrieve
- `POST   /api/v1/characters` — create
- `PATCH  /api/v1/characters/:id` — update
- `DELETE /api/v1/characters/:id` — delete (soft / hard)
- `POST   /api/v1/characters/:id/portrait` — upload portrait
- `GET    /api/v1/characters/:id/stream` — SSE real-time updates

### Schema & Reference

- `GET /api/v1/schema` — character schema + UI metadata (ETag-cacheable)
- `GET /api/v1/abilities` — ability catalogue

### DM & Recovery

- `GET  /api/v1/dm/validate` — validate DM token
- `POST /api/v1/recover` — recover a character with a backup code (rate-limited)

### Backups (DM only)

- `POST /api/v1/backups/characters/:id` — create backup
- `GET  /api/v1/backups/characters[/:id]` — list backups
- `POST /api/v1/backups/restore` — restore from backup

## Authentication

Header-based, self-asserted (see [ADR-003](docs/decisions/003-self-asserted-identity.md)):

- `x-player-id` — player identification
- `x-dm-id` — DM/admin token (compared against `NAGARA_DM_TOKEN` with
  `crypto.timingSafeEqual`)

## Production Deployment

Production runs as `nagara.team` over HTTPS. HTTP connections redirect to
HTTPS. SSL certificates are kept outside the repo (`../secrets/ssl/`).

1. Set `NODE_ENV=production` and create `config/nagara.production.env`.
2. Provide SSL paths via `SSL_KEY` / `SSL_CERT`.
3. Set a strong `NAGARA_DM_TOKEN`.
4. Set `CORS_ORIGINS` to the explicit origin whitelist.
5. Ensure `data/` is writable.
6. Run with `npm start` or a process manager (pm2, systemd).
