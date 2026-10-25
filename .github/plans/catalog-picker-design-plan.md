# Plan — Catalog picker: visual design (Figma rounds → code)

**Status:** active (2026-10-25) — workspace set up in Figma; round 1 not
started. Companion to
[`catalog-picker-dialog-plan.md`](./catalog-picker-dialog-plan.md): that
plan owns **what the dialog does** (behavior, data, API — its S2 / S2b
decisions are fixed inputs here); this one owns **how it looks** and
feeds its step 2c (dialog CSS pass).
**Owner:** user (design authority, final visual calls, SVG art in
Illustrator) + agent (Figma drafts, decision log, SVG cleanup, CSS)
**Session note:** sessions start cold. This file + the Figma areas below
are the hand-off. Start a session with "continue the picker design per
`catalog-picker-design-plan.md`"; end it by updating the round log and
decisions here.
**Trigger:** The only picker design is an early draft frame. The picker
needs per-catalog variants and responsive breakpoints; exploring those
one-by-one in code is too slow, so options are drafted side by side in
Figma, the user picks and tweaks, and only the chosen direction goes to
code.

**Size rule:** keep this file short (aim ≲ 250 lines). Detail lives in
Figma frames, not prose. When a round closes, replace its notes with
one-line decisions and one-line rejections; don't keep transcripts.

## Where things live

- **Figma page** `Nagara Character Builder` (`1017:14`), file per the
  **ui-figma-source** rule.
  - `picker` (`1389:14`) — below `view` in the column. **Approved** picker
    frames only (catalog × breakpoint), same container style as its
    neighbors.
  - `picker — explorations` (`1389:15`) — section to the right of
    `picker`. One sub-section per round: `rN — <theme>`. Frames named
    `<catalog> / <width> / rN-<letter>` (e.g. `traits / 1200 / r1-b`).
    Rejected frames stay in their round (no deletes); the round's
    heading in the log below says what won.
  - `r0 — original draft (was in view)` (`1389:16`) — holds the original
    `ability-select-popup` (`1166:237`), moved out of `view` 2026-10-25.
- **Decisions** — this file. **Screenshots** — not in git.
- **SVG sources** — the user's `.ai` files stay with the user; the
  cleaned SVG in the repo is the one shipped copy, and Figma imports that
  same file.

## Workflow

1. **Draft** — agent builds 2–4 options for the round's question in the
   round's section (Figma writes don't count against the read budget).
2. **Review** — user reviews on the canvas, picks one, tweaks it by hand
   if wanted, and tells the agent which frame won.
3. **Record** — agent reads the winning frame once (`get_design_context`)
   and logs the decision here. Reads are budgeted (ui-figma-source
   rule), so the agent does not screenshot its own drafts by default —
   the user's review is the visual check.
4. **Code** — once a catalog's layout is settled, it goes to CSS (parent
   step 2c), iterated in the browser against a specimen page (see open
   item S below); results are captured back into `picker`.

## Fixed inputs (do not relitigate here)

From the parent plan — cite, don't copy: S2-1 (select, then commit;
primary footer button + status line), S2-2 (✕ in header, Cancel in
footer), S2-8 (left: full-detail cards; right: search + filters, preview,
Remember / Recall stubs), S2b-4 (filters are checkbox fieldsets), S2-10
(search outside the dismiss form), S2-11 (weapons / armor dialog is out
of scope). Changing one of these is a parent-plan decision, not a design
round.

## Variant matrix

| Catalog | Entry shape | Desktop | Narrow | (middle?) |
| --- | --- | --- | --- | --- |
| Traits (abilities + spells) | 3 tiers, rank blocks | — | — | — |
| Talents (boons + sins) | levels | — | — | — |
| Rituals (Chunk I step 4) | untiered | — | — | — |

Cells: `—` not started · `rN` in exploration · `✅` approved in `picker`.
Breakpoints are open item B.

## Motion & assets

**Motion preference (user, 2026-10-25):** SVG assets do not change color
on state. Hover / focus → rotation and / or scale; activation → a wobble.
All of it off under `prefers-reduced-motion`.

**Assets** (user draws in Illustrator with artistic brushes; outlines are
not fully predictable, so these are briefs, not specs):

| Asset | Role | Brief | Status |
| --- | --- | --- | --- |
| Button border | footer primary / Cancel, maybe chips | Must survive different button widths — see open item A | open |
| Close ✕ | header dismiss | Visual mass centered (it rotates on hover); reads at ~20–28 px; clearly not a "+" | not drawn |
| Background squiggle | dialog surface decoration | Decorative, behind content; must tolerate cropping at narrow widths | not drawn |

**Hand-off:** Illustrator *Export As → SVG* (presentation attributes,
outlined text, no embedded images, 2 decimals, Responsive on). The agent
strips editor ids / metadata, checks the viewBox, wires it into CSS, and
imports the same file into Figma.

## Open items

- **A. Button border technique.** Brush strokes don't stretch cleanly.
  Options: (a) a fixed set of button widths, one SVG each; (b) 9-slice
  `border-image` — corners drawn as distinct ornaments, edges that can
  repeat or stretch; (c) one SVG stretched with
  `preserveAspectRatio="none"` (distorts the brush). Settle in round 1
  with a mock of each.
- **B. Breakpoints.** Desktop is the 1200 × 600 frame (S2-8); step 2c
  requires a narrow fallback (columns stack, list scrolls). Decide the
  widths and whether a middle layout exists.
- **S. Specimen page.** A dev-only page rendering the picker for every
  catalog at every breakpoint side by side, so one CSS edit + one look
  covers the whole matrix. Parent S2-9 chose "no harness file" for the
  step-2 check; this would be a new dev surface. Decide where it lives
  and how it stays out of production before the code phase.
- **D. Early-draft gaps.** Re-check `r0` against the fixed inputs (it
  predates S2-1's footer status line, S2-8's preview slot and the filter
  fieldsets) — round 1 input.

## Rounds

- **r0 — baseline** (`1389:16`): the original popup, kept for reference.

## Decisions log

_(none yet — one line each: `D<n> (date): decision — frame`)_

## Steps

Design rounds are iterative; each step closes when the user approves its
outcome, not on a commit.

- **Step 1 — Round 1: traits layout, desktop.** 2–4 options for the
  overall composition (S2-8 column split, card density, header / footer
  chrome) plus open item A's border mocks. **Done when:** a winner is
  logged and open item A is decided.
- **Step 2 — Talents and rituals variants.** Adapt the winner to levelled
  and untiered entries. **Done when:** both rows approved at desktop.
- **Step 3 — Breakpoints.** Settle open item B; narrow (and middle)
  frames for each catalog. **Done when:** the matrix is all ✅.
- **Step 4 — Assets.** User draws; agent cleans, imports into Figma and
  checks them in the approved frames. **Done when:** all three assets are
  in the repo and placed in `picker`.
- **Step 5 — Hand-off to code.** Settle open item S; parent step 2c
  implements from `picker`. **Done when:** parent step 2c's gate passes;
  this plan moves to `done/`.

## Verification

- Design steps: user approval on the canvas, logged above.
- Code phase: the parent plan's step-2c gate (screenshots at desktop and
  narrow widths, keyboard focus run, reduced motion, `npm test` green).

## References to sweep on completion

- _(none yet)_

## Progress

- [x] Workspace — Figma `picker` / explorations areas, `r0` baseline
  _(2026-10-25)_
- [ ] Step 1 — Round 1: traits layout, desktop
- [ ] Step 2 — Talents and rituals variants
- [ ] Step 3 — Breakpoints
- [ ] Step 4 — Assets
- [ ] Step 5 — Hand-off to code
