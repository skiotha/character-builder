# ADR-007: Strict CORS with Explicit Origins

**Status:** Accepted
**Date:** 2026-03-31
**Deciders:** Project owner + Copilot design session

## Context

The current implementation sets `Access-Control-Allow-Origin: *` on all API responses. This was a development convenience carried over from the original `ahani_server` project.

The character builder client is a same-origin SPA — it is served from the same host as the API, so it does **not** need CORS at all. Browser requests from the SPA to `/api/v1/*` are same-origin and bypass CORS entirely.

The DM sync script (from the addon project) and the Discord bot (malizia) make server-to-server HTTP requests. CORS is a **browser-only** mechanism and does not affect these calls.

However, future plans include:

- The addon project may develop a web-based companion tool hosted on a different origin.
- The Discord bot project may gain a web dashboard.
- Development may use different ports (localhost:3000 vs localhost:5173).

## Decision

**Replace `Access-Control-Allow-Origin: *` with explicit origin whitelisting.**

### Production

Only the website's own origin is allowed by default. Additional origins are added via an environment variable when needed:

```
CORS_ORIGINS=https://nagara.team
```

Multiple origins can be comma-separated:

```
CORS_ORIGINS=https://nagara.team,https://addon.nagara.team
```

### Development

In development mode, the CORS origin defaults to `http://localhost:3000` (or whatever `LOCAL_ADDRESS:PORT` resolves to). Additional dev origins can be added via the same env var.

### Implementation

```ts
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || defaultOrigin).split(",").map((s) => s.trim()),
);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, x-player-id, x-dm-id",
  );
}
```

## Consequences

- **Positive:** No open CORS. API is not callable from arbitrary web pages.
- **Positive:** Easy to relax when a legitimate cross-origin consumer appears — just add its origin to `CORS_ORIGINS`.
- **Positive:** `Vary: Origin` ensures caches handle multi-origin responses correctly.
- **Negative:** When a new sibling project needs cross-origin access, the env var must be updated. This is intentional — access is granted explicitly, not by default.
