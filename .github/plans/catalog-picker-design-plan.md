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
| Traits (abilities + spells) | 3 tiers, rank blocks | — | — | — |
| Talents (boons + sins) | levels | — | — | — |
| Rituals (Chunk I step 4) | untiered | — | — | — |

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
| Focus underline | `:focus-visible` on every text button | A brush stroke under the caption; draw at 112 × 12 (longest caption, ЗАПОМНИТЬ); squeezes for shorter ones — if LEARN (58 px) looks wrong, add a short version (D6) | placeholder in Figma |
| Close ✕ | header dismiss (`Icons/Close` Dialog, 24) and search clear (Clear, 16) | Visual mass centered (it rotates on hover); reads at ~16–28 px; clearly not a "+"; the two may be distinct drawings | placeholder in Figma |
| Tick | checkbox check mark (`Icons/Tick`, 16) | Reads at 16 px; style decided with the Checkbox atom | placeholder in Figma |
| Search glyph | search-field icon (`Icons/Search`, 24) | Reads at ~20–24 px | placeholder in Figma |
| Background squiggle | dialog surface decoration | Decorative, behind content; must tolerate cropping at narrow widths | not drawn |

**Hand-off:** Illustrator *Export As → SVG* (presentation attributes,
outlined text, no embedded images, 2 decimals, Responsive on). The agent
strips editor ids / metadata, checks the viewBox, wires it into CSS, and
imports the same file into Figma.

## Open items

- **A. Button border technique.** ✅ _Resolved 2026-10-27 (D6): (c),
  one SVG stretched with `preserveAspectRatio="none"` — the sketched
  brush tolerates a little distortion, and the button's min-width
  matches the drawing, so today's captions don't stretch it at all._
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
  Clear 16), tick (16)
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
  id, so re-renders don't change it), not tied to kind or state. English
  is the primary language; the served font files are Latin-only subsets
  and the Cyrillic cuts are a user TODO (roadmap l10n item). Built on
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
  32 × 32 around its 24 px glyph. The search-clear ✕ is **not** an icon
  button: it is the native `type=search` cancel control, restyled with
  the Clear drawing via `::-webkit-search-cancel-button` (24 × 24, the
  WCAG 2.5.8 minimum). Accepted trade-offs: it can't be reached with
  Tab (Escape clears the field instead, in Chrome / Safari), and
  Firefox shows **no** clear ✕ at all — its native one has sat behind
  the off-by-default pref `layout.forms.input-type-search.enabled`
  since Firefox 81 (bug 558594), so there is nothing to style.
  **Preferred fix (user, 2026-10-27):** a real clear button shown only
  where `@supports selector(::-webkit-search-cancel-button)` fails, so
  Chrome / Safari keep the native control; implemented with the Search
  input atom. So the Icon button atom serves the
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
  - **Atoms:** ★ Button — built, awaiting review (D6: primary
    (bordered) / plain × default, hover, focus, pressed, disabled;
    placeholder border, broken border and focus underline until drawn),
    ★ Icon button — built, awaiting review (D7: dialog ✕ only;
    default / hover / focus / pressed), ★ Text input — built, awaiting review (D8: empty,
    focused, focused + value, filled, invalid, read-only), ★ Search
    input (carries the native clear ✕ plus the `@supports` fallback
    button, D7), ★ Checkbox +
    label (may look like a chip; S2b-4), ★ Tag / badge (XP cost, check
    attribute, tradition, outside-traditions, learned), ★ Divider
    (h / v), Scrollbar, Loader.
  - **Molecules:** ★ Section heading (+ counter), ★ Dialog header (title,
    XP left, ✕), ★ Filter group (fieldset), ★ Rank block (grade, name,
    cost, prose, check; default / hover / selected / unavailable),
    ★ Action line (special attack / reaction), ★ Meta line (equipment,
    boosted attribute), ★ Dialog footer (status, Cancel, primary),
    Message block (no matches / error + Retry / preview hint),
    Remember / Recall stubs.
  - **Organisms:** ★ Trait card full (default / selected / learned),
    Talent card (Step 2), Ritual card (Step 2), ★ Compact sheet card +
    vacant "+" card, Dialog shell (list | aside + header / footer slots).

  **Done when:** every ★ item is a component on `Components`.

- **Step 1 — Round 1: traits layout, desktop.** 2–4 options for the
  overall composition (S2-8 column split, card density, header / footer
  chrome). **Done when:** a winner is logged.
- **Step 2 — Talents and rituals variants.** Adapt the winner to levelled
  and untiered entries. **Done when:** both rows approved at desktop.
- **Step 3 — Breakpoints.** Settle open item B; narrow (and middle)
  frames for each catalog. **Done when:** the matrix is all ✅.
- **Step 4 — Assets.** User draws; agent cleans, imports into Figma and
  checks them in the approved frames. Code-side colour (D5): the icon
  SVGs swap their baked `style="fill: #…"` for `currentColor` /
  `var(--icon-secondary)` (grade discs: disc + letter custom
  properties); custom properties inherit into `<use>` shadow trees, so
  one file serves every colour and disabled state. **Done when:** every
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
- [ ] Step 0 — Component library (foundations and icons done 2026-10-26)
- [ ] Step 1 — Round 1: traits layout, desktop
- [ ] Step 2 — Talents and rituals variants
- [ ] Step 3 — Breakpoints
- [ ] Step 4 — Assets
- [ ] Step 5 — Hand-off to code
