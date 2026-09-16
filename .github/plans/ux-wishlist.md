# UX wishlist — living notes

Collected UX / design wishes and paper-cuts observed while working on the
client. **Not a plan**: no completion obligation, no sweep list, no status
discipline — items graduate into a real plan or a roadmap bullet when acted
on. Anyone (user or agent) may append; keep entries to one or two lines with
enough context to rediscover the spot.

## Wishes

- **Header `#home` on the welcome page links to itself.** Since the router
  became hash-driven (lifecycle plan step 4) `#home` is `<a href="#dashboard">`;
  with no player token the router falls back to the welcome view, so on
  `#initial-view` the control is a no-op. The Figma `initial` frame
  (`1021:58`) shows it there, so this is a design-expectation update first
  (hide it, or make it mean something) — code follows the frame. Observed
  2026-09-16.
