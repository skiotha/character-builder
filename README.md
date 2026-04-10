# Nagara Character Builder

Web application for creating and managing RPG characters in the Nagara system.

> Extracted from [Gjyr/ahani_server](https://github.com/Gjyr/ahani_server) into a standalone project.

Part of the [nagara](https://github.com/nagara) project family alongside:
- **addon** — World of Warcraft addon (Lua)
- **malizia** — Discord bot (TypeScript)

## Stack

- **Backend**: Raw Node.js HTTP server (zero external dependencies)
- **Frontend**: Vanilla JavaScript SPA with native ES modules (no build step)
- **Storage**: File-based JSON persistence
- **Real-time**: Server-Sent Events (SSE)

## Quick Start

```bash
# 1. Copy .env.example and configure
cp .env.example .env

# 2. Set at minimum the DM token
#    Edit .env: NAGARA_DM_TOKEN=your-secret-token

# 3. Start in development mode
npm run dev

# 4. Open http://localhost:3000
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the server directly |
| `npm run start:dev` | Start with auto-restart on crash (watcher) |
| `npm run typecheck` | Run TypeScript type checker |
| `npm test` | Run backend tests |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | `development` or `production` |
| `PORT` | No | `3000` (dev) / `443` (prod) | Server port |
| `LOCAL_ADDRESS` | No | `127.0.0.1` (dev) / `0.0.0.0` (prod) | Bind address |
| `NAGARA_DM_TOKEN` | Yes | — | Secret token for DM/admin access |
| `SSL_KEY` | Prod only | — | Path to SSL private key |
| `SSL_CERT` | Prod only | — | Path to SSL certificate |

## API

All API routes are under `/api/v1/`.

### Characters
- `GET /api/v1/characters` — List characters (by player or all for DM)
- `GET /api/v1/characters/:id` — Get a character
- `POST /api/v1/characters` — Create a character
- `PATCH /api/v1/characters/:id` — Update character fields
- `DELETE /api/v1/characters/:id` — Delete a character
- `POST /api/v1/characters/:id/portrait` — Upload portrait image
- `GET /api/v1/characters/:id/stream` — SSE real-time updates

### Views
- `GET /api/v1/view/initial` — Initial/login view
- `GET /api/v1/view/dashboard` — Character list dashboard
- `GET /api/v1/view/creation` — Character creation form
- `GET /api/v1/view/character/:id` — Character detail view

### Other
- `GET /api/v1/abilities` — Get all abilities
- `GET /api/v1/config` — Get client configuration
- `GET /api/v1/dm/validate` — Validate DM token
- `POST /api/v1/recover` — Recover character with backup code

### Backups (DM only)
- `POST /api/v1/backups/characters/:id` — Create backup
- `GET /api/v1/backups/characters[/:id]` — List backups
- `POST /api/v1/backups/restore` — Restore from backup

## Authentication

Simple header-based tokens:
- `x-player-id` — Player identification
- `x-dm-id` — DM/admin authorization (must match `NAGARA_DM_TOKEN`)

## Production Deployment

For deploying to `nagara.team`:

1. Set `NODE_ENV=production`
2. Provide SSL certificate paths via `SSL_KEY` and `SSL_CERT`
3. Set `NAGARA_DM_TOKEN` to a strong secret
4. Ensure `data/` directory is writable
5. Run with `npm start` or use a process manager (pm2, systemd)
