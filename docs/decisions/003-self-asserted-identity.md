# ADR-003: Self-Asserted Player Identity

**Status:** Accepted
**Date:** 2026-03-31
**Deciders:** Project owner + Copilot design session

## Context

The character builder needs to identify which player is making a request so it can enforce ownership permissions (only owners can edit their own characters, DM can edit all).

Traditional approaches — email/password registration, OAuth, session cookies — add friction that is inappropriate for this project's audience: a small group of personally-known users (~5–15) who also interact through Discord and World of Warcraft. These users will not tolerate a registration flow for a character sheet tool.

## Decision

Player identity is **self-asserted via the `x-player-id` HTTP header**.

- On first visit, the client generates or receives a human-readable player ID (e.g. `iris-4821`) and stores it in `localStorage`.
- Every API request includes this ID as `x-player-id`.
- The server trusts this header for ownership checks.
- DM access uses a separate mechanism: a secret token in the `x-dm-id` header, compared against the server's `NAGARA_DM_TOKEN` environment variable using `crypto.timingSafeEqual()`.

### What This Means

- Any user who knows (or guesses) another player's ID can impersonate them.
- This is accepted because:
  1. All users are personally known to the project owner.
  2. Server-side validation prevents most destructive actions regardless of identity (e.g. only DM can hard-delete characters).
  3. Soft-deleted characters can be restored from backups.
  4. Ease of use is paramount — users won't deal with login flows.

### DM Token Handling

- The DM token is a long-lived secret, manually placed on DM devices.
- Never committed to source control, never transmitted except over HTTPS in production.
- Compared timing-safely to prevent side-channel leaks.

## Consequences

- **Positive:** Zero-friction onboarding. Users visit the site and start creating characters immediately.
- **Positive:** No email collection, no password storage, no OAuth complexity.
- **Positive:** DM operations are properly secured — the token is the only real credential in the system.
- **Negative:** Player identity is spoofable. A malicious user could edit someone else's character by setting the wrong `x-player-id`.
- **Mitigation:** The userbase is closed and trusted. If the group grows beyond personal contacts, revisit with session tokens or a lightweight auth mechanism. This decision is documented so future developers know it is intentional, not a gap.
