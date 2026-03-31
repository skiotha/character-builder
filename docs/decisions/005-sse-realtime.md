# ADR-005: SSE for Real-Time Character Updates

**Status:** Accepted
**Date:** 2026-03-31
**Deciders:** Project owner + Copilot design session

## Context

During a tabletop RPG session, the DM and the character owner need to see each other's changes to a character sheet in real time. The DM might adjust experience or corruption while the player updates equipment or toughness. Both need to see the result immediately.

Options considered:

**A. WebSockets** — Full-duplex. Rich ecosystem (ws, Socket.IO). Adds a dependency or requires a raw implementation over `node:net`.

**B. Server-Sent Events (SSE)** — Server-to-client only. Built into browsers (`EventSource`), trivial to implement over `node:http` with`res.write()`. No dependencies.

**C. Polling** — Client fetches the character on an interval. Simple but wastes bandwidth and adds latency.

## Decision

**Approach B — Server-Sent Events.**

- Each character has a broadcast channel identified by character ID.
- Clients connect via `GET /api/v1/characters/:id/stream`.
- On every successful `PATCH`, the server broadcasts the full updated character to all connected clients for that character.
- Keep-alive comments (`: keepalive\n\n`) maintain the connection.

### Why Not WebSockets

- All data mutations go through the REST API (PATCH). The client doesn't need to _send_ data over the real-time channel — it just needs to _receive_ updates.
- SSE is natively supported by browsers with automatic reconnection.
- Zero dependencies. Implementation is ~100 LOC.

## Consequences

- **Positive:** Trivial implementation. No external libraries.
- **Positive:** Browsers handle reconnection automatically via `EventSource`.
- **Positive:** Works seamlessly with the existing REST API — PATCH triggers broadcast, no protocol switching needed.
- **Negative:** Server-to-client only. If a future feature needs client-to-server streaming, WebSockets would be required.
- **Negative:** Broadcasting the full character on every update is simple but not bandwidth-efficient. For the expected 2–3 concurrent users per character, this is fine. If it becomes a problem, switch to delta-based updates.
