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
- **Figma page** `Components` (`944:15`, was the empty `In-game`) — the
  reusable component library (see Step 0). Older loose drafts (`fonts`
  `1021:70`, `inputs` `1055:17659` on `1017:14`) stay where they are and
  are superseded as components land.
- **Decisions** — this file. **Screenshots** — not in git.
- **SVG sources** — the user's `.ai` files stay with the user; the
  cleaned SVG in the repo is the one shipped copy, and Figma imports that
  same file.

## Workflow

1. **Draft** — agent builds 2–4 options for the round's question in the
   round's section and screenshots them as a self-check before handing
   over (ui-figma-source call budget).
2. **Review** — user reviews on the canvas, picks one, tweaks it by hand
   if wanted, and tells the agent which frame won.
3. **Record** — agent reads the winning frame once (`get_design_context`)
   and logs the decision here. The user's review is the deciding visual
   check; the agent's screenshots only catch build errors.
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
| Traits (abilities + spells) | 3 tiers, rank blocks | ✅ | — | — |
| Talents (boons + sins) | levels | ✅ | — | — |
| Rituals (Chunk I step 4) | untiered | ✅ | — | — |

Cells: `—` not started · `rN` in exploration · `✅` approved in `picker`.
Breakpoints are open item B.

## Motion & assets

**Motion preference (user, 2026-10-25):** SVG assets do not change color
on state. Hover / focus → rotation and / or scale; activation → a wobble.
All of it off under `prefers-reduced-motion`. Exceptions (D6): disabled
buttons turn grey and swap to a "broken" border; keyboard focus adds a
static underline stroke, so focus stays visible with motion off; focused
icon buttons grow their glyph instead (D7), a static end state that stays
with motion off too.

**Assets** (user draws in Illustrator with artistic brushes; outlines are
not fully predictable, so these are briefs, not specs):

| Asset | Role | Brief | Status |
| --- | --- | --- | --- |
| Button border | primary button only (Learn) | Draw at 128 × 48; stretches a little for longer captions (D6) | placeholder in Figma |
| Button border, broken | disabled primary | Same 128 × 48 frame as the border, visibly broken / interrupted; shown grey (D6) | placeholder in Figma |
| Focus underline | `:focus-visible` on every text button and filter chip | A brush stroke under the caption; draw at 112 × 12 (longest caption, ЗАПОМНИТЬ); squeezes for shorter ones — if LEARN (58 px) looks wrong, add a short version (D6, D10). Several shapes (three placeholders for now, count open) to vary per caption; red by default, yellow under red captions (D17) | placeholder in Figma |
| Chip stroke, unchecked / checked | filter chip fill (`Decor/Chip stroke`) | A single wide brush stroke, at S 64 / M 96 / L 128 × 32 — 6 drawings; the checked one differs in **shape and angle**, not just colour; tilt lives inside the canvas; colours come from CSS (grey / yellow) (D10) | placeholder in Figma |
| Close ✕ | header dismiss (`Icons/Close` Dialog, 24), search clear (Clear, 24, mirrors the search glyph) and sheet-card remove (Remove, 24, D22) | Visual mass centered (it rotates on hover); reads at ~16–28 px; clearly not a "+"; the three may be distinct drawings | placeholder in Figma |
| Tick | check mark (`Icons/Tick`, 16) | Reads at 16 px. The picker no longer needs it — filter chips mark "checked" by stroke shape (D10); keep for a later sheet checkbox or drop | placeholder in Figma |
| Search glyph | search-field icon (`Icons/Search`, 24) | Reads at ~20–24 px | placeholder in Figma |
| Filter glyph | filter toggle at the end of the search row, one column, 360 and below (`Icons/Filter`, 24; r4) | Reads at ~20–24 px as "filter", not "menu"; drawn on the Icon button | placeholder in Figma (three shrinking lines) |
| Alert mark | footer status, before a blocked reason (`Icons/Alert`, 16; D18) | Small red hand-drawn "blocked / attention" mark, readable at 16 px beside Body-14 text; distinct from the outside-traditions mark; colour from CSS | placeholder in Figma |
| Outside-traditions mark | spell badge (D11) | Small red hand-drawn mark, readable at ~16 px, meaning "not your tradition"; may stand alone | not drawn |
| Special attack / reaction marks | action line kind (`Icons/Special attack`, `Icons/Reaction`, 16) | Two small marks, told apart by shape, readable at 16 px beside Body-14 text; colour from CSS (D15) | placeholder in Figma |
| Spell / ability kind marks | entry kind (D15) | A sibling pair (mark, edge or ornament) differing in shape, colour or place; neither kind louder than the other | candidate, round 1 |
| Equipment / attributes / traditions icons | meta line labels (D15) | Small icons that may replace the text labels (e.g. a sword for equipment) | candidate, round 1 |
| Swap hint mark | entry head (D15) | Small mark hinting that a rank lets the character swap an attribute | candidate, round 1 |
| Applied-by-sheet mark | effect line (D21) | Tells "the sheet applies this for you" (Tier A / B) from "remember this at the table" (Tier C); one mark on one side, or a sibling pair | candidate, round 1 |
| Loader | list loading state (parent: pending `entries`) | Hand-drawn; animated (frames or a rotating / drawing stroke), with a static frame for `prefers-reduced-motion`. It shows **alone** (the text is for screen readers only, D19), so the static frame must still read as "loading"; placeholder `Decor/Loader`, 48 × 48 | placeholder in Figma |
| Details marker | `Atoms/Details toggle` (D17) | Small mark beside Body-14, ~12 px; points right when closed and turns (or is redrawn) to point down when open | placeholder in Figma |
| Background squiggle | dialog surface decoration | Decorative, behind content; must tolerate cropping at narrow widths | not drawn |
| Aside artwork | fills the aside's free space (D33) | Decorative. Two areas: beside the preview card in the 410 aside (~202 wide, as tall as the heading and card: 293 for traits, 117 for talents and rituals), and below the card in the slim aside (192 wide, height from 0 to several hundred px). These areas only place the drawing's centre: it may overflow anywhere (under other elements, out of the dialog or the window); sizes settle once it's drawn. Never adds height | placeholder in Figma |

**Hand-off:** Illustrator *Export As → SVG* (presentation attributes,
outlined text, no embedded images, 2 decimals, Responsive on). The agent
strips editor ids / metadata, checks the viewBox, wires it into CSS, and
imports the same file into Figma.

## Open items

- **A. Button border technique.** ✅ _Resolved 2026-10-27 (D6): (c),
  one SVG stretched with `preserveAspectRatio="none"` — the sketched
  brush tolerates a little distortion, and the button's min-width
  matches the drawing, so today's captions don't stretch it at all._
- **B. Breakpoints.** Desktop is now up to 1200 wide × viewport − 64
  tall (D23; was the 1200 × 600 frame, S2-8); step 2c
  requires a narrow fallback (columns stack, list scrolls). Decide the
  widths and whether a middle layout exists. Approach (user,
  2026-11-13):
  - **Widths are found by drawing**, where the design breaks, not
    taken from device sizes. The app's current breakpoints (1440, 920,
    900 px) are ad hoc and are ignored.
  - **Devices are test points**, not breakpoints: a 360 px phone, a
    phone held sideways, a tablet in both orientations, a small laptop,
    and 320 px (WCAG 1.4.10 Reflow, a 1280 px screen at 400 % zoom,
    which makes the narrow layout mandatory). Touch, height and the
    on-screen keyboard get their own queries (`hover`, `pointer`,
    height), separate from width.
  - **One column dissolves the aside** rather than switching panes
    (list–detail or tabs): tools go above the list, the action stays
    pinned, and the preview card moves or goes (round r4).
  - **Usage profile** (user, 2026-11-14): phones and tablets will be
    very rare: a quick check or a look at a character, perhaps browsing
    the catalogs. Play happens at a desktop. Small screens must never
    look broken, and informative features (reading entries, hints,
    search and filters) must work there; involved actions (comparing
    with Remember / Recall) may be left out. This keeps r4 part 4 light.
  - **Body text stays 14 on narrow screens for now** (user, 2026-11-14:
    postponed; revisit after release if it reads too small). Today's
    900 px 14 → 16 rule goes with the old breakpoints. The search field
    still uses at least 16 px on touch screens, or iOS zooms in when it
    gets focus.
- **S. Specimen page.** A dev-only page rendering the picker for every
  catalog at every breakpoint side by side, so one CSS edit + one look
  covers the whole matrix. Parent S2-9 chose "no harness file" for the
  step-2 check; this would be a new dev surface. Decide where it lives
  and how it stays out of production before the code phase.
- **D. Early-draft gaps.** ✅ _Resolved 2026-10-31._ `r0` (1200 × 600,
  frame `1166:237`) shows a title, one entry head, search, a preview
  card and remember / recall captions. Against the fixed inputs it lacks:
  - the header ✕ (S2-2);
  - the whole footer: Cancel, the primary button, the status line
    (S2-1, S2-2);
  - full-detail entries with rank blocks (S2-8);
  - filter fieldsets (S2b-4);
  - the empty-preview hint and disabled stubs (S2-8);
  - the XP counter (D13).

  Step 0 covers all of these as components, and the dialog shell
  example (D23) already assembles them. S2-10 (search outside the
  dismiss form) is DOM order, not layout. **Round-1 checklist:** every
  option must show, or have a sibling frame for:
  1. nothing selected: footer empty, preview hint;
  2. a rank selected: entry Selected, preview filled, footer ready,
     counter projected;
  3. a blocked selection: an unaffordable rank, footer blocked with
     its reason (S2-1, D18);
  4. a selection hidden by search or filters: the preview and footer
     keep it (S2-1);
  5. the list's loading, error, no-matches and empty states (S2-4, D19);
  6. the aside scrolling at a common viewport height (D23).

  Nothing in `r0` carries over beyond what the components already took
  (meta labels → D15, the red divider → D12 / D26).
- **P. Palette roles.** ✅ _Resolved 2026-10-31 (D26): one owner per
  role, one category pair reused, red lifted. Values provisional until
  seen in the full designs._
- **F. Tradition chips.** Dropped for now from traits (spells) and
  rituals (D31): tradition tags plus search already narrow by
  tradition, and the traits aside has no room for eight more chips.
  Revisit once the picker is laid out in code (parent step 2c), with
  the real space and a feel for how search alone works.
  `Molecules/Filter group` keeps its My traditions / Traditions kinds
  until then.

## Rounds

- **r0 — baseline** (`1389:16`): the original popup, kept for reference.
- **r1 — traits layout** (`1629:4122`, drafted 2026-10-31). **Winner:
  `r1-e`, a mix — r1-b's Middle list with Glass tooltips in r1-a's
  chrome (D29).** `r1-e` sits in its own row below the others, with
  its state 1 / 3 / 4 copies. Four 1200 × 800 options, one row each:
  - `r1-a` "as built" — density Full · footer Row · divider Rail ·
    tooltip Outlined · grey empty ✕.
  - `r1-b` "aside owns the action" — Middle · Stacked · Separate ·
    Glass · no empty ✕.
  - `r1-c` "lightest list" — B (Acrobatics Adept opened) · Row · Rail ·
    Glass · grey empty ✕.
  - `r1-d` — A (Acrobatics Adept opened) · Stacked · Separate ·
    Outlined · no empty ✕.

  Pairings are not binding; any axis can be mixed into the winner.
  Each row also carries 50 % copies of states 1 (nothing selected),
  3 (blocked) and 4 (selection hidden by search) from the open-item-D
  checklist; state 5 (Loading / Error / No matches / Empty) is drawn
  once in r1-a chrome below the rows; state 6 (aside scroll) shows in
  the 800-tall frames. The shells are detached copies of the
  Dialog shell example so the list could be "scrolled" (Acrobatics
  first); entries, rank blocks and chrome stay linked instances. Chip
  hover is left to the browser.
- **r2 — talents** (`1656:10124`, drafted and approved 2026-10-31;
  D30). **Winner: `r2-a`** (`1656:10126`), the only option, cloned
  from the approved `traits / 1200`:
  title "Talents", Talent source filter, Cartographer selected at
  level II (70 → 60), then Contacts (one level), Damage (sin) and
  Deceiver; Talent card in the preview; the action tooltip removed
  (talents have no actions). A 50 % copy `r2-a · sin selected`
  (`1656:10742`) shows the Gain projection (70 → 75, "Damage — +5 XP").
- **r3 — rituals** (`1673:10822`, drafted and approved 2026-11-08;
  D31). **Winner: `r3-a`, shipped without its chip** (no tradition
  filters, open item F). Two options, cloned from `r2-a`, which differ
  only in the filters:
  - `r3-a` (`1673:10824`): a single "My traditions" chip.
  - `r3-b` (`1673:11137`): "My traditions" above the eight tradition
    chips.

  Both have the title "Rituals", the counter 1 → 2 / 3, Fata Morgana
  selected, then Fire Stories, Fleshcraft, Foresight and Form, the
  Ritual card in the preview, and "Fata Morgana — free" with "Learn".
  A 50 % copy `r3-a · at the limit` (`1673:11369`) shows the Over
  counter (3 → 4 / 3) and the Blocked footer "An Adept Ritualist may
  know up to three rituals."
- **r4 — breakpoints** (planned 2026-11-13; open item B). Traits
  first; talents and rituals follow once traits settles. In order:
  1. Shrink the approved two-column `traits / 1200` step by step until
     it breaks (the list too narrow for rank blocks). That width is the
     first breakpoint.
     > Drawn 2026-11-13 in section `r4 — breakpoints` (`1682:11097`):
     > `traits / 1100 · 1000 · 900 · 800 / r4-shrink`, the aside fixed
     > at 410. Nothing clips or spills at any width; the layout fails
     > on proportion and line length instead. Rank text runs ~70
     > characters a line at 1100, ~56 at 1000, ~42 at 900 and ~28 at
     > 800. At 900 the list is no wider than the aside, which is mostly
     > empty space, so the list stops leading; 800 is plainly broken.
     > **The full two-column layout holds down to ~960–1000.**
  2. Draw the one-column layout, which **dissolves the aside**: search
     and a Filters button above the list, the footer pinned, the
     preview card placed per the variants below, Remember / Recall
     dropped. Shrink it to 320 px; if it breaks on the way, that is a
     second breakpoint (a separate phone layout).
     > Settled before drawing (user, 2026-11-13): **no Filters
     > button**. The chips sit beside the search when they fit and
     > wrap under it when they don't (every catalog has at most two).
     > **Shell:** a floating dialog at 700; full-screen with 16 px
     > padding at phone widths (480 and below). **Footer:** Row at 700,
     > Stacked at 480 and below. **Card toggle:** drawn both ways, as
     > its own "On your sheet" line and as the status line itself;
     > either way a `<details>` in the footer that grows upward, so the
     > list shrinks and nothing overlaps.
     > Drawn 2026-11-13 (section `1682:11097`, rows 3–5):
     > `traits / 700 · 480 · 360 · 320 / r4-one-dropped`, then
     > `r4-one-toggle` (own "On your sheet" line) and `r4-one-status`
     > (the status line is the summary), each at 700 open, 360 closed,
     > 360 open and 320 open. Phone sizes: 480 × 800, 360 × 740,
     > 320 × 568. Findings:
     > - **The one column holds from 700 down to 320.** Rank text runs
     >   ~76 characters a line at 700 (capped later by the line-length
     >   rule), ~52 at 480, ~36 at 360 and ~29 at 320; no second
     >   (phone) layout is needed for width.
     > - **Header on phones:** title and counter need ~284 px; at 360
     >   and below the counter wraps under the title (`flex-wrap`).
     >   At 480 they share a line.
     > - **Tools:** the chips sit beside the search at 700 and 480 and
     >   wrap under it at 360 and below.
     > - **Height is the real limit on phones.** Header (two lines),
     >   tools (two lines) and the Stacked footer take ~450 of 740 px at
     >   360, leaving the list ~290 px closed.
     > - **The status-line toggle** costs no extra row; the own toggle
     >   costs ~40 px and repeats "On your sheet" next to a status that
     >   already names the pick.
     > - **An in-flow card doesn't work on phones.** Opening it leaves
     >   the list 37–74 px at 360 and breaks at 320 × 568 (no room;
     >   the chips overlap the card). At 700 it halves the list but
     >   works.
     >
     > Settled with Skiotha 2026-11-13, after the drawings:
     > - **The card toggle is the status line** (row 5): its text is the
     >   `<summary>`. The own-line toggle (row 4) is dropped.
     > - **The card opens as a popover** anchored above the footer, over
     >   the list (native `popover`, light dismiss). The list keeps its
     >   height and scroll position. Replaces the in-flow card for every
     >   one-column width.
     > - **The header and tools never wrap onto a second line.** The
     >   counter under the title and the chips under the search are both
     >   rejected; the header gets more compact on phones instead, and
     >   the chips show only on demand.
     > - **The Stacked footer stays on phones.** The status line carries
     >   the toggle, so it can't share a row with the buttons; accepted.
     > - **Compact phone header:** the counter shows only the result,
     >   arrow kept ("→ 40"; colour is not the only cue, WCAG 1.4.1),
     >   and the title steps down to `Fonts/Header-28`, so both share
     >   one line down to 320. The header stays **pinned** (~56 px): the
     >   counter is the live feedback while choosing.
     > - **Chips on demand where they don't fit beside the search** (360
     >   and below): a filter icon button ends the search row and
     >   shows / hides the chip row below it (a disclosure,
     >   `aria-expanded`), with a count badge while any chip is on.
     >   480 and wider keep the chips inline. Not tied to search focus:
     >   on phones focus opens the keyboard, and tapping a chip would
     >   blur it. Reverses the earlier "no Filters button".
     >
     > Drawn 2026-11-13, row 6 `r4-one-final` (y 5340): 700 × 800 card
     > open; 360 × 740 closed, chips shown (1 on), card open; 320 × 568
     > card open. Notes from the drawing:
     > - The compact header gives the list back ~150 px: **437 px at
     >   360 × 740** (was ~290) and 265 at 320 × 568, which now works.
     > - The counter steps down to `Header-28` with the title, keeping
     >   D13's "same size as the title".
     > - **The popover uses the Outlined surface** (`Surface/Base` +
     >   `Border/Decor`, radius token, 16 padding), not glass: glass at
     >   50 % let the list text show through the card and was
     >   unreadable. Glass stays for tooltips.
     > - **New `Icons/Filter`** (`1702:16071`, beside `Icons/Search`; on
     >   the Icon button's swap list). Expanded = the Icon button's
     >   Pressed look (D7's +8° tilt, held static while the chip row is
     >   shown; hover tilts the other way, −12°). The search row has no
     >   gap: the filter button follows the clear ✕ directly, so ✕ →
     >   filter reads the same ~15 px as the field line → ✕ (user,
     >   2026-11-13). The count badge is a 16 px `Surface/Active` dot
     >   with `Text/Inverse` digits, drawn ad hoc for now.
  3. Preview-card placement variants (user, 2026-11-13):
     - **Footer**: an "On your sheet" toggle (`Atoms/Details toggle`)
       in the pinned footer opens the card just above it.
     - **Dropped**: no card on narrow screens; the footer status line
       is the confirmation.
     - **Slim aside** (middle range only): search and filters above
       the list, a ~240 px right column holding only the card.
       > Drawn 2026-11-13 as `traits / 900 · 800 · 700 · 600 /
       > r4-slim`: a Tools row (search fills, chips bottom-aligned to
       > the search line) over the list, and the aside at the card's
       > own 192 px (not 240) holding the "On your sheet" heading and
       > card. Compare stubs dropped. Rank text runs ~62 characters a
       > line at 900, ~52 at 800, ~44 at 700 and ~30 at 600, where the
       > search field also shrinks to 150 px. **The slim aside holds
       > from ~1000 down to ~720–760.** It earns its place: a single
       > column at 900 would run rank lines past 100 characters unless
       > capped.
       > Remember / Recall restored 2026-11-13 (user): `Compare stubs`
       > Layout = Stacked under the card in all four frames (D32).
       > Removed again the same day (D33): compare lives in the
       > two-column layout only, and the slim aside keeps the heading,
       > the card and the aside artwork below it.
  4. Touch and height: hints that open on tap (the action tooltips
     need hover today), tap-target sizes, a phone held sideways
     (~360–430 px tall), the on-screen keyboard over search.
     > Touch hints, settled 2026-11-14 (user):
     > - **A tap opens the same tooltip** (D15: each trigger is a real
     >   button; popover with anchor positioning, flipping to stay on
     >   screen). A tap outside or on the trigger again closes it.
     > - **A tap on a hint trigger only opens the hint**; a tap
     >   anywhere else in the rank block selects the rank. The block
     >   passes clicks on to its head only when they didn't land on
     >   another control.
     > - **Hover motion only where hover is real**
     >   (`@media (hover: hover)`); touch browsers fake a sticky hover
     >   after a tap.
     > - Dotted term words keep their size: WCAG 2.5.8 exempts targets
     >   inside running text.
     > - Drawn: `traits / 360 / r4-touch-hint` (row 6, x 2620), the
     >   Glass Text tooltip opened by a tap on "Bounce Back". At 320 px
     >   wide it fits inside the 360 dialog with 24 px either side, so
     >   phones need no separate tooltip size.

     > Tap targets, settled 2026-11-14 (user):
     > - **Measured at 360 / 320:** Learn / Cancel 48 tall, the rank
     >   blocks (whole block is the target, ≥ 125 tall) and the popover
     >   rank rows (42) are already comfortable. The dialog ✕ and the
     >   filter button (32 × 32), the search-clear ✕ (24 × 24, touching
     >   the filter button), the chips (64 × 32, 8 apart) and the
     >   status line (full width, 21 tall) meet WCAG 2.5.8 (24 px, AA)
     >   but fall short of 44 px (2.5.5 AAA, Apple's guideline).
     > - **Invisible 44 px tap zones on touch screens**
     >   (`@media (pointer: coarse)`): the controls keep their drawn
     >   size; the zone grows with padding or a transparent pseudo-
     >   element. Mouse users see no change.
     > - **Clear ✕ beside the filter button, split at the seam:** the
     >   gap stays at 0. The clear zone reaches left over the field's
     >   empty end (x 260–304 at 360); the filter zone reaches right
     >   and up / down (304–348). The field's text must stop at the
     >   clear zone (`padding-inline-end`), so typed text never runs
     >   under it.
     > - **Chips keep their size:** the zone grows to 44 tall and into
     >   half of the 8 px gap on each side (72 × 44), so neighbouring
     >   zones meet without overlapping.
     > - The status line's zone grows to 44 tall; 4 px are left above
     >   the footer buttons.
     > - Drawn: `traits / 360 / r4-tap-zones` (row 6, x 3060), a copy of
     >   the chips-shown frame with a magenta annotation layer
     >   (`Tap zones (annotation)`) showing each zone. Not part of the
     >   design; it is there for the hand-off (open item S).

     > Short windows, settled 2026-11-14 (user):
     > - **A rule by height, whatever the width:** below **500 px**
     >   tall (`@media (max-height: 500px)`) the picker uses the short
     >   layout. Phones held sideways (320–430 tall) land there; a
     >   1280 × 720 laptop (1920 × 1080 at 150 %, ~550–600 px of page
     >   under the browser bars and taskbar) keeps its width layout and
     >   Remember / Recall. 600 was the alternative, so the slim aside
     >   would never scroll; rejected for that laptop case.
     > - **One top bar:** title with the compact counter, the search
     >   field, the filter button and the dialog ✕ in one row; the chips
     >   sit behind the filter button (as on phones). No aside: the
     >   status line opens the "On your sheet" card as a popover, as in
     >   one column; a popover taller than the room above the footer
     >   scrolls inside itself. Compare is unavailable, as in one
     >   column.
     > - **One-row footer:** status line on the left, Cancel / Learn on
     >   the right.
     > - **Measured list heights** (844 wide): slim aside 273 / 173 / 63
     >   at 600 / 500 / 390 tall; short layout 299 at 500 and 189 at
     >   390. With the switch at 500, the shortest list either side is
     >   ~175–190 px.
     > - Drawn: row 7 of the breakpoints section, `r4-short-slim` at
     >   844 × 600 / 500 / 390 and `r4-short-bar` at 844 × 500 / 390.

     > On-screen keyboard, settled 2026-11-14 (user):
     > - **The keyboard covers the footer; the layout stays still.**
     >   This is the default in iOS Safari and Android Chrome
     >   (`interactive-widget=resizes-visual`), so no code is needed.
     >   The search field sits at the top, so it stays in view, with
     >   ~300 px of results under it at 360 × 740. Learn is out of
     >   reach only while typing, and nothing jumps when the keyboard
     >   closes. Rejected: shrinking the dialog above the keyboard
     >   (list ~200 px, needs `visualViewport` script on iOS, which
     >   ignores `interactive-widget`, and the layout jumps).
     > - **No autofocus on touch screens:** the picker opens without
     >   focusing the search field when `(pointer: coarse)` matches, so
     >   the keyboard appears only when someone taps the field. Desktop
     >   keeps `autofocus` (today's `catalog-dialog.mjs` sets it
     >   unconditionally).
     > - **The "Search" key moves focus to the first result**
     >   (`enterkeyhint="search"`): focus only, no selection. On touch
     >   it closes the keyboard; on desktop it jumps to the results.
     >   Enter still can't submit, because the field sits outside the
     >   `method="dialog"` forms.
     > - Drawn: `traits / 360 / r4-keyboard` (row 6, x 3500), the
     >   search field focused with "bounce" typed, and a grey
     >   annotation box where the ~290 px keyboard sits.

     > ✅ **Completed 2026-11-14.** Divergences from the text above:
     > the short-window rule switches at 500 px tall, above the
     > 360–430 named here, so the slim aside just above it keeps a
     > list as tall as the short layout's at 390; tap sizes are met
     > with invisible zones, not bigger controls.

## Decisions log

- D1 (2026-10-26): component library before round 1 — Step 0; page
  `Components`, one section per layer, slash names by layer
  (`Atoms/Button`) + variant properties.
- D2 (2026-10-26): foundations — `Primitives` + `Semantic` collections,
  one mode (`Dark`). No light / inverted mode now: components bind only
  to `Semantic`, so an "Inverted" mode can be added later without
  redrawing. `Fonts/Menu-22`, `Fonts/Body-12` added;
  `Navigation-36` dropped (unused; removed from the CSS too) —
  `Foundations` sheet `1403:15`.
- D3 (2026-10-26): 1rem = the browser default (16px) — the root
  `font-size` clamp (10px rem scaled by viewport width) is gone, as it
  ignored the reader's font-size setting and damped zoom. Old 10px-rem
  literals in `styles.css` were divided by 1.6 (same px); the
  catalog-dialog block was already authored in 16px rem and now renders
  at the S2-8 1200 × 600. Spacing tokens moved to a 4px scale: 8 / 16 /
  24 / 32 / 48 / 80 (were 8 / 15 / 20 / 30 / 48 / 75), Figma
  `Space/*` likewise; `--border-width` is `1px`. Drift outside the
  picker is left to the later in-depth CSS pass.
- D4 (2026-10-26): the old CSS values are not binding. Step 0 components
  may introduce new tokens (on the 4px scale, added to `Primitives` /
  `Semantic` and the `Foundations` sheet) whenever the old ones don't
  fit — groundwork for the roadmap's design-token rework (Phase 8).
- D5 (2026-10-26): icons. Originals stay the source
  (`public/common/icons/`); the user drops them into empty, labelled
  slots on the `Components` Icons sheet, and the agent scales them,
  binds the fills and derives variants. Colour comes from variables,
  never baked hexes: `Icon/Default` (→ Main), `Icon/Secondary`
  (→ Accent), and the grade pairs `Grade/Ability` (Main disc, Black
  letter — learned ability), `Grade/Spell` (Accent disc, White letter —
  learned spell), `Grade/Unlearned` (Grey disc, Black letter). The stray
  `#f1c724` yellow and Plus Item's original grey are unified to Main.
  Pluses and up arrows are named by job, in files
  (`icon-plus-<use>.svg`, `icon-up-<use>.svg`) and in Figma
  (`Use=<Use>`): plus Character (dashboard new-character card), Talent
  (talent add, shared with portrait upload), Trait (trait add), Item
  (reserved for the future weapon / armour pickers); up Talent (talent
  upgrade) and Spare (unused). Pluses are distinct and never
  substituted. Both up arrows stay until one is chosen; the picker uses
  neither, because upgrading happens on the sheet. ✕ (Dialog 24 /
  Clear 24 — was 16; enlarged to mirror the search glyph, user
  2026-10-27), tick (16)
  and search (24) are placeholders until hand-drawn. Slots are bounding
  boxes on the 4px grid: grade 40, plus 48, up 32 × 36 / 36, and the
  asymmetric art sits centred and scales with the component. Grade rows
  share one drawing per grade; the layers are named `Disc` / `Letter`.
  Borders are not icons; they get placeholders at the Button step.
- D6 (2026-10-27): text buttons. The picker has five, captions
  uppercase in Zen Kurenaido 20 (`menu-20`; colour may differ per
  button): **Learn** (primary commit; one caller label for all three
  catalogs, as the picker only adds), **Cancel**, **Remember** /
  **Recall** (disabled stubs) and **Retry** (load-error line). The ✕ is
  an icon button whose accessible name is "Close", not a text button.
  Only the primary has a hand-drawn border; the rest are plain text.
  Widths at 20 px (EN / RU, measured from the fonts): LEARN 58 /
  ИЗУЧИТЬ 85, CANCEL 69 / ОТМЕНА 75, REMEMBER 97 / ЗАПОМНИТЬ 111,
  RECALL 67 / ВСПОМНИТЬ 110, RETRY 59 / ПОВТОРИТЬ 108 — so the border is
  drawn at 128 × 48 (ИЗУЧИТЬ plus padding, on the 4px grid) and the
  primary's min-width is 128; it stretches only for longer future
  captions (open item A). Captions in different languages should stay
  close in length. States: hover → rotate / scale; pressed → wobble;
  focus → a hand-drawn underline stroke under the caption (static, so it
  survives reduced motion; it may sit off-centre and run past the
  primary's border, which the user approved on the Figma draft as part
  of the sketched look); disabled → caption and border turn grey
  (`Text/Disabled`-style token, added at the build) and the border swaps
  to a "broken" drawing. Each button carries its own tilt, a rotation in
  −3°…+3°, with separate angles for caption and border, fixed per button
  (in code: `--tilt-caption` / `--tilt-border` derived from the button's
  id, so re-renders don't change it), not tied to kind or state. The two
  are deliberately disjoint (user, 2026-10-27): caption and border may
  lean at different angles, even in opposite directions, and hover /
  pressed motion may move them by different amounts and directions. English
  is the primary language; the served font files are Latin-only subsets
  and the Cyrillic cuts come from the originals in `fonts-src/` in the
  Step 4 font pass (roadmap l10n item). Built on
  the Atoms sheet `1440:9`: `Atoms/Button` (`1439:74`; Kind × State,
  TEXT property `Caption`, default "Learn" — the property is set-wide,
  so every variant shows the same caption), `Decor/Button border`
  (`1439:67`, Whole / Broken) and `Decor/Focus underline` (`1439:72`) as
  placeholder components whose `Art` layer the drawings replace; new
  tokens `Text/Disabled`, `Border/Disabled` (→ Grey) and text style
  `Fonts/Button-20` (Menu-20, uppercase). Figma cannot rotate layers
  inside an instance, so drafts tilt the whole button; the separate
  caption / border angles exist only in code.
- D7 (2026-10-27): icon buttons. States follow D6 and the motion
  preference: no colour change; hover → rotate, pressed → wobble,
  focus → the glyph grows (24 → 30 px, ×1.25, inside the 32 × 32 click
  area). The scale is a static end state, so it stays under
  `prefers-reduced-motion` (only the transition drops). No underline,
  and hover doesn't scale, so focus can't be mistaken for hover. Click area: dialog ✕
  32 × 32 around its 24 px glyph. The search-clear ✕ (24 × 24, the
  WCAG 2.5.8 minimum) is **open until implementation**; two options:
  - *Native control — on shaky ground (user, 2026-10-27).* The native
    `type=search` cancel control, restyled with the Clear drawing via
    `::-webkit-search-cancel-button`. Trade-offs: it can't be reached
    with Tab (Escape clears the field instead, in Chrome / Safari);
    Firefox shows **no** clear ✕ at all — its native one has sat behind
    the off-by-default pref `layout.forms.input-type-search.enabled`
    since Firefox 81 (bug 558594), so there is nothing to style — and
    the earlier preferred fix was a real button shown only where
    `@supports selector(::-webkit-search-cancel-button)` fails. Worse,
    the control lives inside the input box, so the lines and fill would
    have to become background gradients that stop short of it (D9): the
    workaround outweighs the "don't rebuild what the browser gives"
    benefit.
  - *Scripted button — now favoured.* A standalone `Atoms/Icon button`
    beside the input, outside the lines, with the native control hidden
    (`::-webkit-search-cancel-button { appearance: none; display: none }`).
    It is reachable with Tab, looks and behaves the same in every
    browser, and the field keeps plain borders. Costs: a little script
    (show while the field has text; clear, fire `input`, return focus to
    the field). This also drops the `@supports` fork.

  So the Icon button atom serves the
  dialog ✕ now and the sheet's plus / up buttons later. Built on the
  Atoms sheet: `Atoms/Icon button` (`1448:23`; State × 4, an
  instance-swap property `Icon` defaulting to Icons/Close Dialog, with
  the Close / Plus / Up icons as preferred values).
- D8 (2026-10-27): text input, from the existing sheet CSS (the
  `div.input` pattern). Two horizontal lines (top and bottom borders,
  `Border/Default`); the label (Body-14, `Text/Heading`, 8 px in) sits
  between them while empty and unfocused, and above the top line once
  focused or filled; the value is Menu-20, 24 px in, so label and value
  are deliberately offset. Field height 32 unfocused → **48** focused
  (was 50; on the 4 px grid, matches the button). Focus: the field grows
  upward, the top line turns `State/Focus` red, the field fills
  `Surface/Active` yellow, typed text turns **black** (`Text/Inverse`,
  10.4 : 1 on yellow; white was 1.7 : 1), and the caret is a static red
  bar (`caret-shape: bar; caret-animation: manual` — it doesn't blink).
  The placeholder shows only while focused, as black **Italic-14**
  (trial), so a hint can never be mistaken for an entered value — this
  matters once SSE patches values after blur; the old red-on-yellow hint
  was 2.5 : 1. Unfocused filled text is `Text/Default` white. Invalid
  (filled only): label and lines pulse yellow ↔ red (2 s, endless);
  under `prefers-reduced-motion` they hold steady red. Read-only: lines,
  label and value grey, text not selectable (as today). No separate
  disabled state. Every human-entered field shows its text capitalized
  (user, 2026-10-27), search included: `text-transform: capitalize` is
  visual only, and matching stays case-insensitive (parent S2b-3). The
  global rule covers `textarea, input[type="text"]` today, so code must
  add `input[type="search"]`. Selection is red with white text. The
  picker uses only
  empty / focused / filled (via the Search input); the rest serve the
  sheet. Built on the Atoms sheet: `Atoms/Text input` (`1454:31`;
  State = Empty / Focused / Focused filled / Filled / Invalid /
  Read-only; TEXT properties Label, Value, Placeholder; 160 × 56, the
  focused field overflows 16 px upward like the CSS; value and caret
  share an auto-layout row so the caret follows the text).
- D9 (2026-10-27): search input. The Text input (D8) between a
  **search glyph on the left** (`Icons/Search`, 24; recognition at a
  glance; 8 px gap) and the **clear ✕ on the right** (Clear drawing, 24,
  mirroring the glyph's size and 8 px gap; it may move closer to the
  field once the real drawings exist), both **outside** the lines and
  the yellow fill, on
  the dark background, so a yellow icon stays visible (10.4 : 1; a red ✕
  on yellow would be 2.5 : 1, under the 3 : 1 icon minimum). The ✕
  shows whenever the field has text, focused or not. Both icons stay
  `Icon/Default` yellow: red is **not** adopted as "interactive",
  because it already means focus (top line, caret), alert / invalid and
  spells; interactivity is carried by shape, hover motion and cursor.
  Code is open (D7): if the ✕ stays the native cancel control, it lives
  inside the input box, so the lines and fill must be background
  gradients that stop short of its area instead of borders — the reason
  that option is shaky; the favoured scripted button sits outside and
  leaves plain borders. The label reads
  "Search"; the placeholder hint names what is matched ("Name or tag"
  in the draft, per catalog `search.fields`). Built on the Atoms sheet:
  `Atoms/Search input` (`1460:31`; State = Empty / Focused / Focused
  filled / Filled; 320 × 56; the field is an exposed nested Text input
  instance, so Label / Placeholder / Value are edited on it).
- D10 (2026-10-27): filter chips (replace the plain checkbox look for
  S2b-4 groups). A chip is a toggle, not an action, so it looks unlike
  a button: 32 tall, ~12 px side padding, caption `Fonts/Body-14`, not
  uppercase, no border. Code: each chip is a native checkbox inside its
  `<label>`, the box visually hidden but focusable, groups stay a
  `<fieldset>` + `<legend>` (ADR-012); styled with `:has(:checked)`.
  Look: a hand-drawn single wide brush stroke fills behind the caption —
  **unchecked a grey stroke** (`Surface/Muted` → Grey), **checked a
  yellow stroke** (`Surface/Active`) of a **different shape and angle**,
  so the state reads by shape, not colour alone (WCAG 1.4.1; yellow vs
  grey is only 1.95 : 1). Caption black (`Text/Inverse`) on both: 5.3 : 1
  on grey, 10.4 : 1 on yellow (white on grey would be 3.3). Grey also
  means disabled elsewhere; accepted, since the picker has no disabled
  chips and hover motion plus the pointer show interactivity. The swap
  is animated: both strokes are stacked layers; on check the grey one
  fades while the yellow one is revealed by a left-to-right
  `clip-path: inset(0 100% 0 0) → inset(0)` wipe (freshly brushed), and
  the reverse on uncheck; under `prefers-reduced-motion` the swap is
  instant. If the wipe looks wrong, other cues get explored. Sizes:
  three drawings per state, **S 64 / M 96 / L 128 × 32** (6 drawings),
  picked by caption width (≤ 40 / ≤ 72 / ≤ 104 px at Body-14, measured
  in Figma: Spell, Ability, Boon, Sin, Order, Circle, Tribe, Sirens,
  Runes → S; Theurgy (50), Sorcery (47), Symbolism (65) → M; My
  traditions (80), Способность (82), Заклинание (74), Мои традиции (91)
  → L); captions are centred on the stroke;
  captions should stay short and of similar length. Tilt: the strokes
  carry their tilt inside their own canvases; the caption gets a slight
  per-chip CSS tilt, disjoint from the stroke's (as in D6). Focus: the
  shared `Decor/Focus underline` under the chip; pressed: the button
  wobble. Hover: **open** — a small rotation or a very small caption-only
  scale; no translucent / faint strokes (the palette stays solid).
  Built on the Atoms sheet: `Atoms/Chip` (`1467:65`, block `1467:177`;
  Size S / M / L × Checked × State Default / Hover / Focus; TEXT
  property `Caption`; the focus underline overhangs the 32 px frame) with
  placeholder `Decor/Chip stroke` (`1466:66`, Size × Checked) until
  drawn; new token `Surface/Muted` → Grey.
- D11 (2026-10-27): small labels, built as **trial atoms** (outcome:
  D29 — tradition tag, XP cost and check attribute deprecated; badge
  open for Step 3). The final card
  layout is unknown, so all four are built and any that find no place
  or add noise are deprecated later. None are interactive, and none may
  look like a chip (filled stroke) or a button (border).
  - *Tradition tag* — spells only (no ability or talent carries one):
    plain small text, `Text/Muted`, several keys joined by " · " (a spell
    may belong to several, e.g. anathema: Runes · Theurgy · Circle). No
    fill, border or hover.
  - *Outside-traditions badge* (parent open item B) — the full phrase
    likely won't fit, so options are explored: a red hand-drawn mark
    (`Icon/Alert`-style; marks need only 3 : 1, red on black is 4.11)
    with short yellow or white text, or the mark alone with an
    accessible name / tooltip. Red text alone is out (4.11 : 1 < 4.5 for
    small text). The mark is one more drawing.
  - *XP cost* — the rank's cumulative cost ("10 XP"); default plus an
    unavailable (grey) look, though the rank block's own unavailable
    state may make that redundant.
  - *Check attribute* — the italic word that opens a rank text in the
    vault (Cunning, Resolute…), kept as an inline italic word.
  - *Learned* is dropped: the picker hides learned entries (parent
    decision 13) and the sheet shows learned state with grade discs.
    Catalog `tags` stay searchable but are not shown.
  - Built on the Atoms sheet (block `1475:116`): `Atoms/Tradition tag`
    (`1475:92`), `Atoms/Badge` (`1475:94`; Style = Mark + yellow / Mark
    + white / Mark only), `Atoms/XP cost` (`1475:106`; State = Default /
    Unavailable), `Atoms/Check attribute` (`1475:111`); each has a TEXT
    property. Placeholder `Icons/Outside traditions` (`1475:90`, 16, in
    the Drawings block) and new token `Icon/Alert` → Accent.
- D12 (2026-10-27): divider and scrollbar. **Scrollbar:** standard
  properties only — `scrollbar-width: thin`, `scrollbar-color: <yellow>
  transparent` (Chrome / Edge 121+, Firefox 64+, Safari 26.2+), plus
  `scrollbar-gutter: stable` so the list doesn't shift when filtering
  stops it scrolling. No `::-webkit-scrollbar` (non-standard, ignored by
  Chrome once the standard properties are set, and absent in Firefox /
  iOS). Measured in Chrome on Windows: gutter 10 px, thumb ~6 px with
  rounded ends; the browser owns the thumb shape and, with classic
  scrollbars, small arrow buttons in the thumb colour (the user's Chrome
  may not show them — overlay / Fluent scrollbars). **Divider:** a
  straight 1 px `Border/Default` line, vertical or horizontal; may go
  unused. **Divider as rail (trial; rail chosen, D29):** the list | aside divider is drawn
  through the list's scrollbar gutter (in code a 1 px background
  gradient on the list showing through the transparent track), so the
  thumb rides on it. Both A (rail) and B (separate) are kept and tried
  in the complete dialog design before choosing (user, 2026-10-27).
  Built on the Atoms sheet (block `1479:145`):
  `Atoms/Divider` (`1479:92`; Orientation), `Atoms/Scrollbar`
  (`1479:95`; Orientation × Rail), examples A (rail, `1479:108`) and B
  (separate, `1479:125`); loader placeholder `Decor/Loader` (`1479:106`,
  48 × 48) in the Drawings block.
- D13 (2026-10-27): headings and the dialog header. **Title** = the
  catalog's name, like the sheet panel ("Abilities", "Spells", "Boons",
  "Rituals"; talents became "Talents", D30), in `Fonts/Header-36`, `Text/Heading`; not a verb phrase.
  **Aside headings:** only one, above the preview ("On your sheet"), in
  `Fonts/Header-28` (was `Menu-22`; D24), `Text/Heading`; search, filter legends and Recall
  speak for themselves. **Counter** = the XP balance as a bare number in
    `Fonts/Header-36` — same size as the title; the sheet
    panel's 64 is too big in the dialog (user, 2026-10-27) (no visible
    "XP" label; in code an `<output>` with a visually hidden "XP left").
  While a rank is selected it **projects** the balance after the pick
  (colours and motion revised by D24): old balance → new balance, with
  an ASCII hyphen ("-5") when it
  would go negative — the font's "−" reads as a long dash. **Dialog
  header** = title and counter on a shared baseline, counter pushed
  right, ✕ (`Atoms/Icon button`) in the top-right corner, 24 px after
  the counter; the counter can be hidden for callers without a balance.
  Implementation notes: the parent plan's `header` option is a static
  node, so projecting needs the dialog to re-render it on selection
  change (e.g. `header?: Node | (selection) → Node`) — settle in parent
  step 2c or the abilities caller step. The served Header subset
  (`amenu-en*.ttf`) lacks "→"; the original `zenkurenaido.ttf` has it,
  so add it when re-subsetting (Step 4 font pass). Built on the Molecules sheet:
  `Molecules/Section heading` (`1485:128`; Level = Title / Aside; TEXT
  Title), `Molecules/Counter` (`1485:123`; Projection = None /
  Projected / Over; TEXT Balance, After), `Molecules/Dialog header`
  (`1485:129`; BOOLEAN Counter; exposes the nested title and counter).
- D14 (2026-10-28): filter group. One `<fieldset>` of `Atoms/Chip`
  checkboxes per S2b-4 group, chips 8 px apart. **Legend visually
  hidden** (still read by screen readers): with groups this small
  (Ability / Spell, Boon / Sin) the chips speak for themselves. **One
  wrapping row** for all groups, 24 px between groups, 16 px between
  rows (a group longer than the column wraps inside itself). **Start
  unchecked**: nothing checked already shows everything (S2b-4), so a
  click narrows ("only spells") instead of hiding. **No match counts**
  on chips (they lengthen captions, push chips into bigger strokes and
  change while typing). **Tradition chips:** both the single "My
  traditions" chip and one chip per tradition (8, two rows at 410 px)
  are kept for the round-1 layouts; the final choice stays with open
  item B (since D31: neither is used for now; open item F). Built on the Molecules sheet (block `1493:231`):
  `Molecules/Filter group` (`1493:230`; Kind = Source / Talent source /
  My traditions / Traditions; hidden `Legend` layer) and four example
  rows at the 410 px right-column width. Chip captions were re-centred
  on the stroke in `Atoms/Chip` along the way; a slightly off-centre
  caption is acceptable later as part of the hand-drawn feel, but not
  pursued deliberately now (user, 2026-10-28). Which chips the picker
  actually uses is still open (round-1 layouts).
- D15 (2026-10-28, revised the same day): meta and action lines — the
  lines a picker **entry** is made of. *Entry* is the word for a list
  item in the picker (traits now, talents later); *card* stays for the
  sheet. **The entry tells everything useful for play:** the picker is
  the only place a player learns what a trait does, so an entry carries
  every rules-relevant fact, as clearly as possible; which facts earn
  their space is explored and A/B-tested in the round-1 layouts.
  Bookkeeping (tags, `source`, ids) is never shown. **Names in full:**
  entries have room for "Mystical Tradition: Order", so the name is not
  cut and no kind line repeats its prefix (the cut is reserved for the
  narrow preview cards, if they need it). **Meta line:** a *label +
  value pair* — labels `Text/Muted` (5.3 : 1; the old red labels failed
  AA at 14 px and red is not "interactive", D7) in a right-aligned
  column (88 px at first; sized to the longest label since D27), values `Text/Default`, as in the old sheet card's grid (in
  code a `<dl>` whose rows share one grid). Facts:
  - *Equipment* ("Equipment — Stiletto", 23 abilities): text now; a
    hand-drawn icon (a sword) in place of the label is tried in round 1.
  - *Attributes* ("Attributes — Discreet"): the attributes the entry's
    effects roll against (`check`, 27 abilities) or let the character
    swap to (`setBase`, 8 abilities), so players can steer towards
    their strong attributes. Written in full ("Discreet");
    abbreviations ("Dis") stay for the compact sheet card. The swap
    itself is an **effect** and stays in the rank text as authored — no
    extra line restating it, and no entry ever asserts a *default*
    attribute ("attacks use Accurate"), since another trait may swap
    it (the engine takes the highest, ES §setbase). A small hint mark
    that a swap hides in the ranks is a candidate for round 1.
  - *Traditions* (spells; "Traditions — Runes, Theurgy, Circle"); this
    makes the D11 tradition-tag atom a likely deprecation.

  Icons in place of labels (equipment, attributes, traditions) are an
  option to test, not a commitment; text may be just right. Longer
  labels are another option for the entry tests: "Starting equipment"
  for *Equipment*, and "Base attribute" or "Default attribute" for
  *Attributes* (clearer, but they widen the label column from 88 px to
  about 130; "default" must not read as the engine default the entry
  never asserts).
  **Spells vs abilities:** the two must be told apart at a glance —
  buying spells makes a character a mystic, which players pursue — but
  neither kind is more important. Whatever marks a spell (a hand-drawn
  mark, edge or ornament; red is still available for marks and edges,
  which need only 3 : 1) has a sibling of a different shape, colour or
  place on abilities. Colour never works alone (WCAG 1.4.1); the shape
  or the traditions line carries it too. Explored in round 1.
  **Tooltips** are a candidate element: if the muted text is not
  enough, purely mechanical detail (numbers, conditions) may move into
  tooltips later. Not needed for now — the examples read well inline;
  the generic component is D17.
  **Action line:** one paragraph per special attack / reaction, after
  the rank's effects: a 16 px hand-drawn **mark** for the kind (two new
  drawings: special attack, reaction), the name `Text/Heading`, the
  conditions `Text/Muted` in parentheses (reaction trigger, "free",
  weapon restriction from `appliesTo`), then the description
  `Text/Default` — "Feint (free; precise or short weapons): Perform a
  Feint attack." Implementation note: the 14 trigger keys (`onHit`,
  `onAttacked`, `onProne`, …) and `appliesTo` need human phrases in
  both locales (a small lookup table, parent step 4). Built on the
  Molecules sheet (block `1504:311`): `Molecules/Meta line` (`1504:299`;
  Kind = Pair; TEXT Label, Value; the Kind line variant was removed in
  the revision),
  `Molecules/Action line` (`1504:310`; Kind = Special attack /
  Reaction; the paragraph is one text node with coloured ranges, so it
  is edited directly, not through a property), placeholders
  `Icons/Special attack` (`1504:290`) and `Icons/Reaction` (`1504:292`)
  in the Atoms Drawings block, plus example entry heads (Smoke and
  Mirrors, Mystical Tradition: Order, Acrobatics, Anathema) and the
  longest action description.
- D16 (2026-10-28): rank block — one rank of a picker entry. **Layout:**
  the three ranks stack (novice, adept, master) at full entry width; a
  row of three columns would wrap effects of up to 185 characters too
  hard. **Head:** grade disc (`Icons/Grade`, 32 px) + rank name
  (`Menu-20`, `Text/Heading`) + **cumulative** cost (`Body-14`,
  `Text/Muted`: "10 XP", "30 XP", "60 XP"; revised by D21 from step
  costs, since the picker always buys from nothing), on one baseline. The disc's colour
  doubles as the spell / ability sibling marker D15 asks for: yellow
  for abilities, red for spells. **Body**, indented under the name:
  effects (`Body-14`), then action lines (D15). **No rank description
  in the picker:** it restates the effects listed below it. The
  `description` field stays in the data for siblings that want a
  briefer list.
  **Check attribute:** every effect with a `check` already names the
  attribute in its text (45 of 45; 41 open with it, four name it
  mid-sentence — Wrestling novice and adept, Sorcery master, Demiurge
  Hands master), so the word is emphasised **wherever it stands**
  (`Text/Heading`, matched from the localized attribute name; RU
  follows the same "Attribute, чтобы…" pattern) instead of being
  repeated as a prefix. No authoring rule is needed. The D11
  check-attribute atom is a likely deprecation, and so is the D11
  XP-cost atom, which the head now carries. **Control:** a `<button>`
  may hold only phrasing content, so the **head** is the button (in the
  entry's tab order); the whole block shows hover and passes clicks to
  it. **Selection and focus are independent:** selecting happens on
  activation (click, Enter, Space), while Tab / arrows only move focus.
  A selected rank may keep focus (keyboard, and the S2b-2 re-render
  restores it) or not (focus moved on, selection restored on reopen or
  Recall). A mouse click doesn't match `:focus-visible`. So the
  component has two properties. **Selection:** None; Selected (4 px
  bar along the block); **Included** (the same 4 px bar: the ranks
  below the selection, since choosing Adept buys Novice too, so the bar
  runs from the first rank to the selected one; any extra "selected"
  effect, if one is added, marks the selected rank only); Unavailable
  (too expensive, or master at creation: the head greys to
  `Text/Disabled` with the unlearned grey disc; it is
  `aria-disabled`, so it stays focusable and keyboard users reach it;
  the body stays readable and the head gives the reason after the
  cost, "60 XP · 5 short" / "60 XP · not at creation", tied to the
  head by `aria-describedby`; not the footer, which describes the
  current selection only, D18).
  **Interaction:** Default; Hover (the disc rotates — motion, not
  colour, as for other controls; none on Unavailable); Focus
  (`Decor/Focus underline` under the rank name). The bars are **final
  CSS lines**, not placeholders (like dividers and scrollbars, D12).
  **Spell colour** (also D15's sibling marker): spells turn red only
  where red stays legible — the entry name (`Text/Spell` → Accent,
  large text only: 4.11 : 1 passes the 3 : 1 large-text bar), the grade
  discs and the bars (`Grade/Spell`, 3 : 1 for non-text). Small text
  (rank names, action names, emphasised attributes) stays yellow, so
  there is no new "text red" token. A focus underline under a caption
  that is itself red turns yellow (`State/Focus on accent` → Main);
  otherwise it stays red. Data note: some ranks state a reaction twice,
  as a prose effect and as the typed reaction (Acrobatics adept: "Quick
  check to instantly spring to your feet…" and *Bounce Back*); an
  authoring pass may drop the prose copy, or a tooltip (D17) may carry
  it. Built on the Molecules sheet (block `1514:457`):
  `Molecules/Rank block` (`1514:456`; Selection = None / Selected /
  Included / Unavailable × Interaction = Default / Hover / Focus, 12
  variants; TEXT Name, Cost, Reason (the last only on Unavailable,
  after the cost); INSTANCE_SWAP Grade; hidden optional slots
  Effect 3 and Action line 2 that instances switch on; the cost sits at
  the right end of the head), with Acrobatics (ability) and Anathema
  (spell: red name, discs and bars) stacks as examples. Revised the
  same day: Included bar 2 → 4 px, State split into Selection ×
  Interaction, rank description and its BOOLEAN removed, cost moved
  right, spell colour added.
- D17 (2026-10-28): tooltip — one generic molecule (its content can be
  a whole action line, so it is not an atom). **No pointer**; rounded
  corners (`Radius/sm`, 8 px); it opens 8 px from its trigger. **Surface** (Glass chosen and density Middle, D29), two on trial until the
  full-entry tests: Outlined (`Surface/Base` + 1 px `Border/Default`,
  like dividers) and Glass (`Surface/Glass` + background blur, no
  border; it shows only where it covers content, so check it over
  dense text). **Content:** Text (one `Body-14` paragraph — a quality
  or term explained, a mechanical aside) or Rich (a slot holding
  molecules — e.g. the effect behind an action line; the data links
  special attacks / reactions to their rank only, not yet to one
  effect, so per-effect links need a data change first). **Behaviour**
  (WCAG 1.4.13): opens on hover **and** focus, stays while the pointer
  is over it, Esc closes it; touch has no hover, so a tap opens it —
  the trigger must be a real control. Native route: Popover API + CSS
  anchor positioning (`popover="hint"` / `interestfor` are newer —
  check support at implementation). What actually moves into tooltips
  is decided in the full-entry tests (D15). Built on the Molecules
  sheet (block `1527:535`): `Molecules/Tooltip` (`1527:636`; Surface =
  Outlined / Glass × Content = Term / Text / Rich; TEXT Term,
  Definition) with both surfaces shown in place over an Acrobatics
  Adept + Master stack. **Term** (240 px): the term's name in
  `Text/Heading` above its catalogue definition — the small tooltip
  for marked words (below). Also from this discussion:
  `Decor/Focus underline` (`1526:504`) became a set — Shape 1 / 2 / 3
  (placeholder strokes; varying them per caption may look livelier;
  the count stays open) × Tone = Default (`State/Focus`) / On accent
  (`State/Focus on accent`).
  **Revised 2026-10-29 — lighter entries.** Making entries lighter (so
  the list is easier to scroll and scan) is a direction to explore, not
  a requirement. Four **densities** are mocked as full entries in round
  1:
  - **Full:** everything inline (today's rank block).
  - **Middle:** effects inline; each special attack / reaction keeps
    its mark, name and conditions, and its description moves into a
    Term tooltip on the name.
  - **A:** effects inline; special attacks / reactions sit behind
    Details.
  - **B:** the rank `description` inline; effects, special attacks and
    reactions sit behind Details.

  **Long content never goes into a hover tooltip.** In A and B the
  hidden content is what the player chooses by. Hover-reading it means
  comparing from memory, a tap per rank on touch, poor screen-reader
  support, a pop-up on every Tab through the rank heads, and a panel
  covering the neighbouring ranks. So it sits behind a **Details
  toggle** (native `<details>` / `<summary>`) and opens **in place**:
  the list grows instead of being covered. Find-in-page opens a closed
  one by itself. Hover tooltips stay for short things only: a term, or
  an action's one-line description (Middle).
  **Term tooltips:** a word in authored text that names a catalogue
  entry gets a dotted underline and a Term tooltip with that entry's
  name and definition. Eventually that means anything in the catalogues
  with an id; implementation starts with **qualities** only. The words
  are linked by **markers in the authored text**, not by matching
  names. Matching fails on inflection: the RU quality is "Неудобное",
  but the effects say "качество неудобного". Normalizing the text to
  one noun form wouldn't fix it either, because a parser can't tell a
  term from the same word used plainly. **Marker shape:**
  `{kind:id}` or `{kind:id|text}`. `kind` names the catalogue
  (`quality`, `status`, `weapon`, `armor`, `ability`, `spell`, `ritual`,
  `attribute`) and `id` is the entry's id. `text`, after the pipe, is
  the word exactly as it stands in the sentence; without it the
  localized catalogue name is shown, which suits English and
  nominative Russian. No catalogue text uses `{`, `}` or `|` today, so
  no escaping is needed. The lint test checks three things:
  - every marker's kind is known and its id exists in that catalogue;
  - `text` is not empty;
  - EN and RU carry the same set of markers per description (the
    locale-drift lint's job).

  It can also use the structured data to warn when an effect targets a
  quality its text doesn't mark. The **highlighted attribute word**
  (D16) moves to the same markers (`{attribute:quick|Quick}`), which
  fixes its RU inflection too. This needs a
  `docs/reference-authoring.md` rule and an authoring pass over both
  locales: a **non-blocking** task in the parent plan, step 4.
  **Tab stops (decided, if tooltips survive the tests):** marked terms
  are tabbable only inside the **current entry**, the one holding
  focus. Elsewhere they carry `tabindex="-1"`, so Tab walks rank head →
  that rank's terms → next rank head within the entry, then jumps to
  the next entry's head.
  Built: `Atoms/Details toggle` on the Atoms sheet (`1538:750`, block
  `1538:641`; Open = false / true × Interaction = Default / Hover /
  Focus; TEXT Caption "Details" / RU «Подробнее»; Body-14
  `Text/Muted`; the marker points right when closed and down when open,
  hover nudges it, focus draws the focus underline). `Molecules/Action
  line` gained Form = Full / Name (Name: mark, name with a dotted
  underline, conditions). `Molecules/Rank block` gained hidden slots,
  BOOLEAN each: Summary (the rank description), Toggle before effects
  (B) and Toggle before actions (A). An **Entry densities** block on
  the Molecules sheet (`1539:673`) shows Acrobatics Adept at Full,
  Middle (with Bounce Back's tooltip), A closed / open and B closed /
  open (with the Unwieldy tooltip).
- D18 (2026-10-28): dialog footer — status `<output>` + **Cancel**
  (plain, in the dismiss form, S2-2) + primary **Learn** last (S2-1).
  **The footer describes the selection only.** An unavailable rank
  can't be selected, so its reason would sit in the footer while Learn
  still buys the earlier selection, and the message would come and go.
  So the reason moved to the rank head (D16), and the status `<output>`
  (a live region, so every change is announced) has three states:
  **Empty** — muted hint "Select a rank to learn.", Learn disabled;
  **Ready** — muted summary of what Learn buys, "Acrobatics, Adept —
  30 XP" (RU «Акробатика, Адепт — 30 опыта»), Learn enabled;
  **Blocked** — the `canCommit` reason (rare once unavailable ranks are
  unselectable: talents, stale data) in `Text/Default` after a small
  red alert mark (`Icons/Alert`, placeholder; red text fails AA at
  14 px), Learn disabled with the broken border (D6). **Layout:** Row
  (status left, buttons right; a full-width footer) and Stacked (status
  above, buttons right-aligned; a right-column footer of ~410 px, where
  two buttons leave too little room beside a reason) — the Dialog shell
  picks in round 1 (Row, divider on — D29). The divider above the footer is optional (BOOLEAN,
  on trial). Built on the Molecules sheet (block `1547:1169`):
  `Molecules/Dialog footer` (`1547:1168`; Layout = Row / Stacked ×
  Status = Empty / Ready / Blocked; BOOLEAN Divider; Cancel and Learn
  are exposed `Atoms/Button` instances, so captions override; the
  status text is a plain per-variant layer, overridden on instances),
  with RU Stacked Blocked, RU Row Ready and a no-divider Stacked Ready
  as examples. `Icons/Alert` (`1547:838`) sits on the Atoms sheet beside
  the other small marks.
- D19 (2026-10-29): message — one molecule for the dialog's
  non-content states, a visual on top, one line of text, an optional
  plain button below. **Loading** (list column): the loader alone,
  shown after ~300 ms so a cached catalog never flashes it; "Loading…"
  is for screen readers only (`role="status"`, list `aria-busy`).
  **Error**: alert mark + `Body-14` `Text/Default` "Couldn't load the
  list." (RU «Не удалось загрузить список.») + **Retry** («Повторить»;
  `role="alert"`). **Empty**: "Nothing left to learn here." («Здесь
  больше нечему учиться.»), everything learned or excluded. **No
  matches**: "Nothing matches." («Ничего не найдено.») + **Clear
  filters** («Сбросить фильтры»), which empties the search and unchecks
  every chip (an addition to the parent's step 2c). **Hint** (preview
  slot, start-aligned): "Select a rank to see it here." («Выберите
  ранг, чтобы увидеть его здесь.»); untiered catalogs need their own
  word. Quiet states (Empty, No matches, Hint) are `Italic-14`
  `Text/Muted`, so they read as remarks, not content. List-column
  states sit centred in the column. Built on the Molecules sheet (block
  `1553:1063`): `Molecules/Message` (`1553:953`; State = Loading /
  Error / Empty / No matches / Hint; text per variant, overridden on
  instances; Retry / Clear filters are exposed `Atoms/Button` Plain
  instances), with RU examples and a 700 × 320 list-column mock.
- D20 (2026-10-30): Remember / Recall stubs — placeholders for the
  roadmap "remember / recall to compare" item (S2-8), which gets its
  own design together with multi-pick. Two plain text buttons,
  **natively disabled** (grey, skipped by Tab, no tooltip: they are
  temporary, and an `aria-disabled` + "Coming later" tooltip would add
  two tab stops that do nothing), in the existing
  `<menu aria-label="Compare">` below the preview. One row, left-aligned
  with the preview, 32 px apart (RU ~253 of ~410 px); the plain
  buttons' padding insets the captions ~16 px, so code may pull the row
  back with a negative inline margin for optical alignment. No heading
  (D13). Optional divider above (BOOLEAN, on trial; kept on, D29). A dashed
  **reserved tray** (design-only, never shipped) keeps ~410 × 196 px,
  room for two ~150 × 180 compact cards (410 × 236 since D28: two
  192 × 236 cards, 16 apart), so round-1 layouts leave the
  space the compare feature will need. Built on the Molecules sheet
  (block `1567:968`): `Molecules/Compare stubs` (`1567:955`; BOOLEAN
  Divider and Reserved tray, both on by default; Remember / Recall are
  exposed `Atoms/Button` Plain Disabled instances), with RU and the
  shipped shape (no tray, no divider) as examples. _Since D32 a
  variant set (`1688:3514`): Layout = Row (`1567:955`, the 410 aside)
  / Stacked (`1688:3507`, the 192 slim aside). Stacked has no instances
  since D33 and is kept in case a narrow compare needs it._
- D21 (2026-10-30): trait entry — the full picker list item (`<li>`),
  for abilities and spells. **Every entry is bought from nothing:**
  learned traits never reach the picker (parent decision 13) and
  upgrades happen on the sheet card, so the rank heads show the
  **cumulative** cost, "10 XP / 30 XP / 60 XP", which is what the click
  costs. It matches the bar running from Novice to the chosen rank, and
  "5 short" is measured against it (D16 revised). Step costs stay on the
  sheet card. **States:** Default and Selected (the `<li>` the dialog
  marks, S2b-2). Selected is shown by the rank bars only, so there is
  one selection signal. There is no Learned state. **Order:** name
  (`<h3>` under the dialog's `<h2>`, so screen-reader users jump between
  entries; `Header-28` (D24; was `Header-36`, which matched the dialog
  title and flattened the hierarchy; red for spells,
  D16),
  then the description (~85 characters, `Italic-14`, `Text/Default`: an
  introduction, kept apart from the effects and the muted labels), then
  the meta lines (equipment, attributes, traditions; D15), then the
  three rank blocks. **Between entries:** a horizontal divider with
  32 px of space on each side, because entries are tall and the line
  shows where one ends while scrolling. **Hidden slots** in the head
  for the round-1 candidates: the spell / ability kind mark and the
  swap hint mark (D15). **Candidate, recorded only:** a mark on each
  effect telling "the sheet applies this" (Tier A / B,
  `docs/reference-authoring.md` §0.4) from "remember this at the table"
  (Tier C). The entry is drawn at 700 px and fills its parent; the
  Dialog shell sets the real width. Densities (Full / Middle / A / B,
  D17) stay as switches on the rank blocks inside the entry, used in
  round 1. Built on the new **Organisms sheet** (`1573:977`, block
  `1573:978`): `Organisms/Trait entry` (`1573:2144`; Kind = Ability /
  Spell × State = Default / Selected; BOOLEAN Equipment (ability
  variants), Attributes (both kinds; spell variants show "Resolute",
  the implied casting roll, since 2026-10-31, reference-authoring
  §0.8), Traditions (spell variants), Divider (on), Kind
  mark and Swap hint (dashed placeholder slots, off); name and
  description are plain per-variant layers, overridden on instances;
  rank blocks Novice / Adept / Master and the meta lines are exposed
  instances), with a two-entry list (Anathema above Acrobatics, Adept
  selected, Master "60 XP · 5 short") and the longest RU name
  (Исключительный Атрибут: Сообразительность; no meta lines, Master
  "· не при создании") as examples. Grade letters N / A / M are the
  same in every locale (they are drawings, not text). An Unavailable rank keeps a fixed
  grey disc, so instances swap in the grey disc of their own grade.
  Built alongside: the rank block's Summary, Effect 3 and Action line 2
  now fill the width (they were fixed at 424 px), and every rank
  example now shows cumulative costs.
- D22 (2026-10-30): compact card — the sheet's trait card and the
  picker preview (S2-8), **one component, two contexts**. *Sheet:* the
  grade **discs are the control** (decision 8): each is a `<button>`;
  a later disc raises to that rank, a lower learned disc lowers to it
  (one PATCH, symmetric refund); the disc tooltip names the action and
  cost ("Raise to Master · 30 XP"; unaffordable discs are
  `aria-disabled` with the reason) and carries the full rank line. ✕
  (`Atoms/Icon button`, placeholder `Icons/Close` Remove, grey: new
  token `Icon/Muted` → Grey, since a yellow ✕ on every card is too
  loud; hover stays motion only) removes the
  trait after an **inline confirmation** in the card ("Remove
  Acrobatics? You get 30 XP back." · Remove / Keep, plain buttons).
  Read-only sheets hide ✕ and leave the discs inert. *Preview:* inert;
  the picked rank and those below are drawn learned. **Name** drops its
  "Prefix:" part ("Cunning", not "Exceptional Attribute: Cunning"; the
  kind shows in the colour), `Menu-22`, yellow / red (D16). **Meta
  lines** (D15 grid; label column sized to the longest label, D27): Attributes on both
    (abbreviated, "Qck"; on spells always "Res", the implied casting roll,
    reference-authoring §0.8), Traditions on spells, Equipment in the preview
  only (starting equipment is in the inventory once the character
  exists). **Rank lines:** 32 px disc + `Body-14` formatter line
  (decision 6), learned `Text/Default` with the attribute emphasised,
  unlearned `Text/Muted`; **clamped to two lines** (`line-clamp`), the
  full text in the disc tooltip; in the preview the full entry sits in
  the list beside it, so no tooltip there. The authored rank `summary`
  fields are all still placeholders (2026-10-30), so the examples show
  formatter-style lines only. Hover rotates the disc, focus underlines
  it (as the rank block, D16). Cards in a row stretch to the tallest
  (flex). **Vacant card:** a card-sized `<button aria-label="Add
  trait">` with Plus Trait centred; hover rotates the plus, focus
  underlines it; hidden on read-only sheets. **Width: 192 px** (150,
  from the old one-screen sheet drawing, cut almost every line and the
  RU card worst; 224 was not needed). How the sheet shows traits is
  rethought in the later full redesign. Built on the
  Organisms sheet (block `1579:1763`): `Organisms/Compact card`
  (`1579:1762`; Kind × Context = Sheet / Preview × State = Default /
  Confirm remove; BOOLEAN Equipment, Attributes, Traditions, Remove
  button; Novice / Adept / Master exposed instances of
  `Organisms/Compact rank` (`1578:1559`; State = Learned / Unlearned ×
  Interaction = Default / Hover / Focus)), `Organisms/Vacant card`
  (`1579:1978`; Interaction), and examples `1581:1750`: a sheet row
  (EN ability, spell, RU, "Cunning", vacant), the preview in a 410 px
  aside, and the disc-hover tooltip
  beside the confirm state. Figma: set `maxLines` after
  `textTruncation`, or it resets.
- D23 (2026-10-30): dialog shell — native `<dialog>`, **width
  min(1200 px, viewport − 64), height viewport − 64** (32 px above and
  below; not tied to r0's 1200 × 600). Surface/Base, `Radius/md` (30,
  `--md-crns`; the agreed 32 was rounded to the existing token rather
  than adding one), 1 px `Border/Muted` edge (`Border/Decor` since
  D26), padding 32
  (`Space/block-outer`) everywhere. **Backdrop:** new token
  `Surface/Backdrop` → Color/Black-50 plus an 8 px background blur on
  `::backdrop`. **Layout:** the Dialog header (D13) spans the top; the
  body is list (fills) | divider | aside (410, S2-8); the aside holds
  search, filters, "On your sheet" heading, then the preview card (or
  the Hint message, D19), then Remember / Recall (D20). Header and
  footer stay put; the **list and the aside scroll on their own** (the
  aside's content needs ~765 px, so it scrolls even at 880 tall — the
  compare stubs sit below the fold on a 1080p / 125 % screen; round 1
  may trim the aside). Footer **Row** (full width, under the body) vs
  **Stacked** (bottom of the aside) and divider **Rail** vs
  **Separate** (D12) are kept as variants for round 1. A hidden,
  dashed **Squiggle** layer marks where the background decoration
  goes. Narrow layout stays with open item B. Built on the Organisms
  sheet (block `1588:3320`): `Organisms/Dialog shell` (`1588:3184`;
  Footer = Row / Stacked × Divider = Rail / Separate, drawn 1200 ×
  880; BOOLEAN Entries, List message, Filters, Preview card, Preview
  hint, Compare stubs, Squiggle; header, entries, search, filters,
  preview, stubs and footer are exposed instances) and an example: a
  1536 × 864 viewport (1080p at 125 %) with the dialog at 1200 × 800
  over the dimmed, blurred old sheet. Its state is consistent since
  2026-10-31: Acrobatics Adept selected, counter Projected "70 → 40",
  footer Ready "Acrobatics, Adept — 30 XP". Built alongside:
  `Atoms/Scrollbar`'s rail now stretches with the instance (it was
  fixed at 240), and a Foundations swatch for `Surface/Backdrop`.
- D24 (2026-10-30): type ladder and counter colours. **Entry names
  drop to a new `Fonts/Header-28`** (`--header-28`, 1.75rem), so the
  shell reads title 36 → entry name 28 → rank name 20; the title stays
  `Header-36` (a bigger title, both changes, or TorukSC for the title
  were the alternatives). Applied to `Organisms/Trait entry` and the
  D15 example heads, with a specimen row on the Foundations type ramp.
  **The aside heading** ("On your sheet", `Molecules/Section heading`
  Level = Aside) moves from `Menu-22` to `Header-28` too, so it
  outranks the preview card's `Menu-22` name instead of matching it
  (the user preferred a bigger heading over a smaller card). Ladder:
  title 36 → aside heading / entry name 28 → card name 22 → rank
  name 20.
  **Counter colours:** the idle balance is `Text/Muted` (no need to
  draw the eye; let players explore). While a rank is selected: old
  balance and arrow muted → new balance `Text/Heading` (yellow, pale
  gold since D26: make the player aware of the choice) when
  affordable, or `Text/Alert`
  (red, "-5") when not. **Over is kept** for the one case that still
  reaches it after D16: the balance drops while the dialog is open (DM
  edit, another tab) and the held selection becomes unaffordable,
  paired with the Blocked footer (D18). **Motion:** nothing appears
  instantly. Either the balance element cross-fades to the new value
  while its colour shifts and "15 →" fades in to its left (one element
  for the number), or the old "15" slides left and "→ 5" fades in
  where it stood (separate elements); the reverse on deselect.
  Instant under `prefers-reduced-motion`. The choice follows the
  markup, settled in parent step 2c or the abilities caller step.
- D25 (2026-10-31): search clear ✕ when empty — **trial**. Instead of
  an empty slot, the ✕ stays in place as an inert grey mark while the
  field has no text (Empty, Focused) and turns yellow (`Icon/Default`)
  once there is text; the colour change is a CSS transition, instant
  under `prefers-reduced-motion`. New token `Icon/Disabled` → Grey
  (beside `Text/Disabled` / `Border/Disabled`; grey already reads as
  "disabled" on buttons and the D20 stubs). The empty ✕ is a natively
  `disabled` button: skipped by Tab, no hover motion, nothing to
  announce. The sheet card's ✕ (D22) is also grey but live — a
  different context, watch for confusion in round 1. A persistent ✕
  rules out the native cancel control (it appears only with text), so
  adopting this settles D9's code question for the scripted button.
  Built on `Atoms/Search input` (`1460:31`): BOOLEAN `Empty clear`
  (on by default while on trial; off restores D9's empty slot), with
  a Foundations swatch for `Icon/Disabled`. Since D26 `Icon/Disabled`
  is the dimmer `Grey-dim`, so the inert ✕ no longer matches the live
  grey sheet-card ✕. Kept by round 1 (D29).
- D26 (2026-10-31): palette roles — **one owner per role**. The
  inherited five-colour palette (from the character's personal site)
  overloaded every hue: yellow was headings + decoration + interactive
  + abilities, red was focus + alert + spells, grey was muted +
  disabled. The identity colours stay; the roles split:
  - **Yellow** (`Color/Main`) = interactive only: buttons, rank
    names, XP costs, field lines, scrollbar thumb, live icons
    (`Text/Interactive`, `Border/Default`, `Icon/Default`).
  - **Pale gold** (`Color/Pale-gold`, oklch(90% .06 88), 13.3:1) =
    headings (`Text/Heading`; the D24 projected balance follows it),
    and non-interactive status marks: the special attack and reaction
    icons (new `Icon/Marker`; they were yellow and read as clickable).
  - **Ochre** (`Color/Ochre`, oklch(62% .12 80), 4.9:1) = design:
    dialog frame and squiggle (were `Border/Muted`, D23), dividers,
    scrollbar rail, loader, tooltip outline (`Border/Decor`).
  - **Red** (`Color/Accent`) = attention only: focus and alerts.
    Lifted to oklch(64% .21 30) (#f14634, 4.8:1; was 4.1:1) so small
    alert text passes AA.
  - **Grey** = don't-look-at-me (`Text/Muted` etc.); **Grey-dim**
    (oklch(45% .012 46), 2.4:1, contrast-exempt) = disabled
    (`Text/`, `Border/`, `Icon/Disabled`).
  - **Category pair, reused across catalogs** (option 1 of the
    board): Kind A = verdigris oklch(74% .11 185) (abilities, boons),
    Kind B = amethyst oklch(74% .11 300) (spells, sins) — equal
    lightness and chroma so neither outranks the other, 7.5–8.2:1.
    Tokens `Text/Kind A` (new), `Text/Kind B` (was `Text/Spell`),
    `Grade/Kind A|B` and `Grade/On-kind A|B` (were Ability / Spell;
    both badges now carry black glyphs).
  Rejected: two pairs (abilities/spells + sky/rose boons/sins) — four
  new primitives for lists that never sit side by side in the picker.
  The sheet-card ✕ stays grey despite being live (D22: the user did
  not want it yellow). The Cancel caption stays white
  (`Text/Default`): the quieter of the two footer buttons, by choice.
  Applied by remapping Semantic aliases and
  rebinding the nodes whose role differed from their old token
  (button captions, rank names, XP cost → `Text/Interactive`; ability
  names → `Text/Kind A`; dividers, rail, loader, tooltip outline →
  `Border/Decor`). The candidate board and today-vs-proposal mocks
  stay in the **Explorations** section (`1601:3358`). The user will
  judge the palette in the full designs; the values are provisional
  until then. CSS: the new primitives are added to `styles.css` and
  `--color-accent` is lifted; usages are not remapped until the CSS
  pass.
- D27 (2026-10-31): meta-line spacing. The indent before a fact label
  was never padding or reserved space: labels sat right-aligned in a
  fixed column (88 px in entries, 72 px in compact cards), so the
  indent was just the column's unused width — and with a single row
  (sheet card: Attributes only) it aligned with nothing. "Снаряжение"
  (77 px at Body-14) also overflowed the 72 px column. Now **the label
  column is as wide as the group's longest label** (CSS: one `<dl>`
  grid, `grid-template-columns: max-content 1fr`), labels stay
  right-aligned: a single row has no indent, and a shorter label is
  indented only to line its value up with the others. Applied to
  entries and compact cards alike. **Rows in a group sit 4 px apart**
  (new token `Space/block-tight`, `--block-tight-pad: 0.25rem`; was 8,
  or 6 in the D15 examples) so they read as one block; the gap from
  the name or description above stays 8. In Figma the rows are wrapped
  in a `Meta` frame and `Molecules/Meta line`'s label hugs its text;
  groups set every label to the longest one's width. (Compact card
  gaps changed since: D28.)
- D28 (2026-10-31): compact card — **fixed head, tighter spacing, 32 px
  discs**. The card's gaps had never been decided; they were scale
  defaults taken during the build and left the card loose. Nothing was
  reserved in them. **No head text wraps**: the name, Equipment,
  Attributes and Traditions stay on one line. Values that are too long
  get shortened (smaller icons, rewording, dropping the less important
  word); for now they truncate. Only rank lines wrap, to two lines
  (D22). By the data, a head holds at most **the name plus two meta
  rows**: abilities have Equipment (preview only) + Attributes, spells
  have Attributes + Traditions, and spells never carry starting
  equipment, so that row was dropped from the spell preview. So the
  **head has a fixed height of name + two meta rows** on every card
  (`min-height`; a missing row leaves a blank). Likewise **every rank
  line reserves two lines** (`min-height`; a one-line text is centred
  beside its disc). So sheet cards are equal in height, preview cards
  are too, and the two contexts match. Gaps: name → meta **4**
  (`Space/block-tight`, was 8); meta rows **0** (was 4, D27; the
  21 px line height separates them); head → ranks **8**
  (`Space/block`, was 16); between ranks still 12. **Disc: 32 × 32**,
  the trait-entry size (was a 40 × 40 icon overflowing a 32 slot);
  the rank text stays at x 40, so the freed 8 px is breathing room
  around the disc. A card is now 236 tall (was 227–298). Figma:
  `Organisms/Compact card` Head has `minHeight` 78, and
  `Organisms/Compact rank` has `minHeight` 42; meta values have
  `textTruncation` Ending, `maxLines` 1.
- D29 (2026-10-31): round 1 winner — **traits at 1200, a mix of r1-b's
  list and r1-a's chrome** (`traits / 1200 / r1-e`; approved copy
  `traits / 1200` in `picker`). It settles the Step 1 trials:
  - **Density Middle** (D17): effects inline, no rank description
    (D16), each special attack / reaction keeps its mark, name and
    conditions, and its description moves into a **Term** tooltip on
    the name (name as the term, description as the definition).
  - **Tooltip surface Glass** (D17), for both Term uses (actions and
    marked words).
  - **Footer Row** (D18) with its divider on; the Compare stubs
    divider (D20) stays on too.
  - **Divider as rail** (D12 A): the list's scrollbar rides on the
    list | aside divider.
  - **Empty clear ✕ kept** (D25): grey and inert while the field is
    empty. This settles D9 / D7's code question for the scripted
    button.
  - **List states** (D19) as drawn: Loading, Error, No matches, Empty.

  **Nothing is deleted from the components.** The losing variants are
  **parked** as narrow-screen candidates for Step 3, where a single
  column may need the Stacked footer, a separate scrollbar or Details.
  Parked: Tooltip Surface = Outlined, Dialog footer Layout = Stacked,
  Dialog shell (every variant except Row / Rail), Scrollbar Rail =
  false, the Rank block's Summary / Toggle before effects / Toggle
  before actions slots (densities A / B), `Atoms/Details toggle`.
  **Deprecated**, with no foreseen use: the D11 trial atoms
  `Atoms/Tradition tag` (the Traditions meta line replaced it),
  `Atoms/XP cost` (the rank head carries it) and `Atoms/Check
  attribute` (inline emphasis, D16). `Atoms/Badge` stays open for
  Step 3 (outside traditions). Each is marked in its component
  description and with a small "Parked" / "Deprecated" label beside
  it on its sheet. The r1-a…d frames stay in their round, labelled
  "not chosen (D29)".
  Still open: chip hover (D10), left to the browser in parent step 2c.
- D30 (2026-10-31): **talents adaptation** (Step 2). Talents have 1 or 3
  levels (not ranks), one entry-wide description, an entry-level
  `check`, and sins *grant* XP. So:
  - **Title** "Talents" (amends D13's "Boons"): boons and sins share the
    dialog, split by the Talent source filter (parent decision 9).
  - **Level pick in the list row**: level discs I · II · III; the
    chosen one carries the cumulative cost (5 / 10 / 15 XP). A
    single-level talent (31 boons, every sin) shows **one disabled
    disc**, for consistency, with its cost beside it.
  - **XP gain**: sins write their cost with a "+" ("+5 XP"), and the
    counter gains a **Gain** projection (70 → 80) in Kind B amethyst
    beside None / Projected / Over.
  - **Talent compact card**: a new, smaller set (name, level, one
    summary line, like the old sheet panel). Its sizes only need to
    match the other talent cards (form cards are equal per section).
    The summary line is a placeholder; a talent `summary` field is
    parent step 5's call (S0-3).
  - **Draft**: one talents layout adapted from r1-e, with no rival
    options unless something turns out unclear.

  **Built:**
  - `Icons/Level` (`1652:3443`, beside `Icons/Grade`): the grade disc
    with a Philosopher Bold numeral, a placeholder until Step 4. Status
    is Boon / Sin / Unlearned / Disabled, and Level is I / II / III.
  - `Molecules/Level pick` (`1653:3471`): Kind × Levels × Chosen, with
    32 px discs and a right-aligned cost.
    - With nothing chosen, the cost reads "5 / 10 / 15 XP".
    - Levels above the pick turn Unlearned.
  - `Organisms/Talent entry` (`1654:3535`): Kind × State, plus
    BOOLEAN Attributes and Divider.
    - The name sits above a bar-marked block: the Level pick as its
      head, then the description in Body-14 / Text/Default and the
      check attributes.
    - The effects (all flags) aren't listed, because the
      description already says what they do.
  - `Organisms/Talent card` (`1654:3605`): 192 × 60. Kind ×
    Context, plus BOOLEAN Level up. The current level is a 24 px disc,
    and the summary is one truncated line.
  - The counter's Projection = Gain (`1654:3607`).

  **Approved 2026-10-31** (r2-a, nothing changed in it). Also settled:
  - The primary button reads **"Take"** for talents, RU «Выбрать»
    (user, 2026-11-08). The "On your sheet" caption is RU «В чарлисте»
    for now; it may change in development, and no replacement is
    expected to be longer in either locale.
  - The empty-preview hint reads "Select a talent to see it here."
  - The single-level disc stays grey.

  The approved copy is `talents / 1200` (`1658:10175`), with the sin
  selected copy (`1658:10202`), in `picker`.
- D31 (2026-11-08): **rituals adaptation** (Step 2). Rituals are free,
  untiered, and capped by the Ritualist ability (Novice 1 / Adept 3 /
  Master 6 known; `rpg/ru/01-core/magic.md`). So:
  - **Title** "Rituals" (D13). **Primary button "Learn"**, as for
    traits; the Ready footer reads "Form — free".
  - **Counter: known against the limit**, "1 → 2 / 3", no XP. At the
    limit the button is disabled and the footer explains it (Blocked).
  - **Ritual entry**: the name above a bar-marked block with the
    description and a **Traditions** meta line. The whole entry is the
    click target (no rank to pick). No Attributes line: not every ritual
    has a check, and the description names the Will check where one
    exists.
  - **Ritual card**: 192 × 60, as the talent card. The name (truncated
    if needed) and a Traditions line ("Order · Circle"), from existing
    data; no new field.
  - **Filters**: none. Two exploration variants were drawn (a single
    "My traditions" chip, or every tradition chip plus "My traditions");
    neither was chosen. Every spell and ritual already carries its
    traditions as localized tags, which search matches (parent S2b-3),
    so the chips would mostly repeat what search does. The traits
    picker, where the same chips would serve spells, has no room for
    them either. Revisit with the real layout (open item F).
  - The compare tray keeps 410 × 236 in every dialog, the largest card
    it will hold (two trait cards); its note no longer names a card
    size.
  - Implementation notes (drop the stored `level`, enforce the limit)
    went to Chunk I step 4.

  **Built:**
  - `Organisms/Ritual entry` (`1672:3599`): State = Default /
    Selected, plus BOOLEAN Divider. The name is in Text/Kind B (the
    spell ink, since rituals are the spells' family), above a bar-marked
    block with the description and the Traditions meta line.
  - `Organisms/Ritual card` (`1672:3756`): one component, no variants.
  - `Molecules/Counter`: TEXT Limit ("/ 3", Text/Muted) and BOOLEAN
    Show limit (off by default) on every Projection.
  - The tray note in `Molecules/Compare stubs` no longer names a card
    size.

  **Approved 2026-11-08** (r3-a, without its "My traditions" chip; the
  aside goes straight from search to "On your sheet"). The approved
  copy is `rituals / 1200` (`1675:10868`), with the at-the-limit copy
  (`1675:10896`), in `picker`. r3-b is labelled "not chosen".
- D32 (2026-11-13, in progress with round r4): **breakpoints** (Step 3,
  open item B). Settled so far:
  - **Three layouts by width**, found by drawing (r4): two columns
    (list | 410 aside) from 1200 down to ~1000; a **slim aside** from
    ~1000 down to ~750; one column below. The exact switch points
    settle in CSS.
  - **Slim aside**: search and the filter chips move into a Tools row
    above the list (chips bottom-aligned to the search line); the
    aside narrows to the card's own 192 px and holds the "On your
    sheet" heading, the preview card and the aside artwork below it
    (D33).
  - ~~**Remember / Recall stay wherever an aside exists**~~ (user,
    2026-11-13; superseded the same day by D33). The slim aside had the
    buttons one per row and the tray as a vertical stack of two
    192 × 236 cards. `Molecules/Compare stubs` became a variant set
    (`1688:3514`) with Layout = Row / Stacked for it; the existing
    instances stay on Row.
  - **One column** (r4 step 2, user, 2026-11-13): a floating dialog
    down to ~480, full-screen (16 padding, no radius) below. The header
    and tools never wrap: on phones the title and counter step down to
    `Header-28` and the counter shows only the result ("→ 40"); the
    header stays pinned. The chips sit beside the search where they
    fit; below that (360 and under) a filter button ends the search row
    and shows / hides the chip row, with a count badge while a chip is
    on. The footer is Row at 700 and Stacked on phones. The status line
    is the `<summary>` for the "On your sheet" card, which opens as a
    popover above the footer, over the list (Outlined surface).
  - **Touch:** a tap opens the same hint tooltip as hover; on
    `pointer: coarse` the small controls get invisible 44 px tap zones
    and keep their drawn size (r4 item 4).
  - **Short windows** (below 500 px tall, any width): one top bar
    (title, counter, search, filter, ✕), chips behind the filter
    button, no aside (the card is a popover), a one-row footer
    (r4 item 4).
  - **Keyboard:** it covers the footer and the layout stays still; no
    autofocus on touch screens; the "Search" key moves focus to the
    first result (r4 item 4). Part 4 is complete.
    Compare below the two-column layout is settled by D33.
  - **Slim aside height:** its content (heading and card) is ~293 px.
    The dialog body is its height minus ~247 px of fixed parts
    (padding, header, footer, gaps), so the aside needs no scroll down
    to a dialog ~540 tall (a window ~600 tall); below that it scrolls
    on its own (D23). The artwork only fills what's left. **A phone held
    sideways** (~850 × 390) falls in the slim width range but leaves
    the body ~80 px: short windows have their own rule, independent of
    width (the short layout above).
- D33 (2026-11-13): **aside artwork; Remember / Recall in the
  two-column layout only** (user).
  - **The aside's free space is the user's artwork**, not empty room.
    In the 410 aside it's the area right of the 192 preview card
    (~202 wide, as tall as the heading and card); in the slim aside it's
    everything below the card. The drawing (or parts of it) is anchored
    there. It is decorative: hidden from assistive tech (`alt=""` / CSS
    background), never focusable, never takes pointer events, and never
    adds height or makes the aside scroll.
  - **The artwork is unbounded** (user, 2026-11-13). It may be loose
    line squiggles, and it may overflow anywhere: past the area, under
    other elements, out of the dialog, out of the window. The area only
    says where the drawing's centre sits; its sizes adapt once the
    drawing exists. In CSS that means an out-of-flow layer (absolute
    position, `pointer-events: none`, behind the content) on a box that
    doesn't clip it.
  - In Figma a dashed design-only placeholder `Artwork (design-only)`
    marks that centre area, like D20's reserved tray: absolutely placed right
    of the card in the approved `traits` / `talents` / `rituals / 1200`
    frames and the r4 shrink frames (202 × 293 for trait cards,
    202 × 117 for the shorter talent and ritual cards), and filling
    the rest of the slim aside in the four r4-slim frames.
  - **Remember / Recall are a two-column feature.** The slim aside
    drops the stubs, and the artwork takes their place. The desktop
    tray stays below the buttons (D20); the preview's right side is the
    artwork, not a compare slot.
  - **Narrow layouts get a fallback, designed with the feature
    (Phase 8).** Losing a feature at narrow widths fails WCAG 1.4.10
    Reflow, which covers zoom: a 1920 px screen at 200 % is ~960 CSS px,
    i.e. the slim aside. Compare doesn't need two cards side by side
    there: e.g. Recall swaps the preview to the remembered card and
    back, one at a time, with no space reserved now. Kept after the
    usage note (user, 2026-11-14): it serves desktop users who zoom
    in, not phones.
  - Remembered entries live in picker state, not the layout. A resize
    or rotation (tablet: two columns sideways, slim aside upright) hides
    the compare UI but never clears it.

## Steps

Design rounds are iterative; each step closes when the user approves its
outcome, not on a commit.

- **Step 0 — Component library.** Discuss and build the reusable pieces
  one by one on `Components` before drafting layouts, binding them to the
  `Semantic` / `Primitives` variables. ★ = needed before round 1; the rest
  can follow its step.
  - **Foundations** ✅ (D2).
  - **Icons** ✅ (D5) — sheet `1416:2`: grade marks novice / adept /
    master × ability / spell / unlearned, plus Character / Talent /
    Trait / Item, up Talent / Spare, all from the
    originals and bound to `Icon/*` / `Grade/*`. ✕ Dialog / Clear, tick
    and search glyph are placeholder components; the hand-drawn versions
    are Step 4 assets (table under "Motion & assets") and replace the
    vector inside each component, so instances update by themselves.
  - **Atoms** ⏳ Partial (approved by the user 2026-10-27; built on the
    Atoms sheet `1440:9`): ★ Button (D6: primary (bordered) / plain ×
    default, hover, focus, pressed, disabled), ★ Icon button (D7: dialog
    ✕; default / hover / focus / pressed), ★ Text input (D8: empty,
    focused, focused + value, filled, invalid, read-only), ★ Search input
    (D9: glyph left, clear ✕ right, both 24 and outside the lines),
    ★ Chip (D10: S / M / L × unchecked / checked × default, hover, focus;
    replaces the planned Checkbox + label), ★ Tag / badge (D11: tradition
    tag, outside-traditions badge options, XP cost, check attribute as
    trial atoms; learned dropped), ★ Divider (h / v) and Scrollbar (D12),
    Details toggle (D17, added with the entry densities).
    Deferred, with where each lands:
    - User drawings replacing the placeholders — button border (whole /
      broken), focus underline, 6 chip strokes, ✕ Dialog / Clear, search
      glyph, outside-traditions mark, alert mark (D18), loader → Step 4
      (Assets).
    - Chip hover (rotation vs caption-only scale, D10) → Step 1, tried
      in the round-1 layouts.
    - Scrollbar A (divider as rail) vs B (separate), D12 → Step 1.
    - Outside-traditions badge option (D11) → Step 3 with open item B.
    - Trial atoms that find no place (D11) are deprecated → Step 1.
    - Native vs scripted search clear ✕ (D7) → implementation (parent
      plan step 2c); scripted if the D25 empty ✕ is kept.
    - Empty-field clear ✕ (D25: grey placeholder vs empty slot) →
      Step 1.
  - **Molecules** (sheet `1481:111`): ★ Section heading (+ counter) and
    ★ Dialog header (title, XP left, ✕) built (D13), ★ Filter group
    (fieldset) built (D14), ★ Rank block (grade, name, cost, effects,
    check; selection none / selected / included / unavailable ×
    default / hover / focus) built (D16), Tooltip (outlined
    / glass × term / text / rich) built (D17),
    ★ Action line (special attack / reaction) and ★ Meta line
    (equipment, attributes, traditions) built (D15),
    ★ Dialog footer (status, Cancel, primary; row / stacked ×
    empty / ready / blocked) built (D18),
    Message block (no matches + Clear filters / error + Retry / empty /
    loading / preview hint) built (D19),
    Remember / Recall stubs (+ reserved compare tray) built (D20).
    All built 2026-10-30 and approved by the user 2026-10-31. Trials left
    open, all for Step 1 (round-1 layouts): tooltip surface (outlined
    vs glass, D17), entry density (Full / Middle / A / B, D17), footer
    layout (row vs stacked) and both divider BOOLEANs (D18, D20).
  - **Organisms** (sheet `1573:977`): ★ Trait entry (the full picker
    list item, D15, D21; default / selected) built (D21), Talent entry (Step 2), Ritual entry
    (Step 2), ★ Compact sheet card + vacant "+" card built (D22; width
    192 px), ★ Dialog shell (list | aside + header / footer; row /
    stacked footer × rail / separate divider) built (D23).

  **Done when:** every ★ item is a component on `Components`.

  > ✅ **Completed 2026-10-31.** Divergences from the text above:
  > the palette was reworked into one owner per role (D26) and the
  > meta-line and compact-card spacing was settled (D27, D28) during
  > the step. Work deferred out of Step 0, each with its home: hand-drawn
  > assets → Step 4; Talent and Ritual entries → Step 2; the open A/B
  > trials (chip hover, scrollbar, empty clear ✕, tooltip surface, entry
  > density, footer layout, dividers, trial atoms) → Step 1; the
  > outside-traditions badge → Step 3; native vs scripted clear ✕ →
  > implementation.

- **Step 1 — Round 1: traits layout, desktop.** 2–4 options for the
  overall composition (S2-8 column split, card density, header / footer
  chrome). **Done when:** a winner is logged.

  > ✅ **Completed 2026-10-31.** Divergences from the text above:
  > the winner is a mix rather than one of the drafted options (r1-e,
  > D29). The losing trial variants are parked as narrow-screen
  > candidates for Step 3 instead of being removed, and three D11 trial
  > atoms are deprecated (marked, not deleted). Chip hover (D10) was
  > not drawn; it moves to the browser in parent step 2c.
- **Step 2 — Talents and rituals variants.** Adapt the winner to levelled
  and untiered entries. **Done when:** both rows approved at desktop.
  > ✅ **Completed 2026-11-08.** Divergences from the text above:
  > - Talents were approved 2026-10-31 (D30, r2-a), rituals 2026-11-08
  >   (D31, r3-a).
  > - Rituals dropped the filter chips altogether, and tradition chips
  >   are parked for traits too (open item F).
- **Step 3 — Breakpoints.** Settle open item B; narrow (and middle)
  frames for each catalog. **Done when:** the matrix is all ✅.
- **Step 4 — Assets.** User draws; agent cleans, imports into Figma and
  checks them in the approved frames. Code-side colour (D5): the icon
  SVGs swap their baked `style="fill: #…"` for `currentColor` /
  `var(--icon-secondary)` (grade discs: disc + letter custom
  properties); custom properties inherit into `<use>` shadow trees, so
  one file serves every colour and disabled state. **Font pass:**
  re-cut the served fonts from the originals in `fonts-src/` with
  fontTools' `pyftsubset` (Python; fontTools 4.67 is installed, add
  `brotli` for WOFF2 output) instead of by hand in FontForge — a
  scripted, re-runnable command per font, Latin and Cyrillic files
  split by `unicode-range`, plus the extra symbols the design uses ("→"
  in the counter, D13). **Done when:** every
  asset in the "Motion & assets" table is in the repo and placed in
  `picker` (glyphs swapped into their `Icons/*` components).
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
- [x] Step 0 — Component library _(2026-10-31)_
- [x] Step 1 — Round 1: traits layout, desktop _(2026-10-31)_
- [x] Step 2 — Talents and rituals variants _(2026-11-08)_
- [ ] Step 3 — Breakpoints
- [ ] Step 4 — Assets
- [ ] Step 5 — Hand-off to code
