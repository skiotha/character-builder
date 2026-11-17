# Plan — Catalog picker: styling (design → code)

**Status:** active (2026-11-15) — written; part 0 (open item S) next,
in a fresh session. Start by discussing S's three questions with the
user before building anything.
**Owner:** user (design authority, reviews every part in the browser,
commits) + agent (CSS, the behaviour the design adds, browser checks)
**Session note:** sessions start cold. This file, the approved Figma
`picker` frames, the `Components` library and
[`docs/design-system.md`](../../docs/design-system.md) are the hand-off.
Keep this file current as parts land (✅ divergence blockquotes under
each part).
**Trigger:** The picker's design is approved for all three catalogs at
every layout
([`catalog-picker-design-plan.md`](./done/catalog-picker-design-plan.md)).
Bringing the dialog up to it was step 2c of
[`catalog-picker-dialog-plan.md`](./catalog-picker-dialog-plan.md), but
the work outgrew one step: chrome, aside, cards, four layouts, states and
motion, plus a few questions left for the browser. This plan owns step
2c; the parent's step 2c is a pointer here.

## Where things live

- **Design source:** Figma file `Nagara`, page `Picker`: the `picker`
  frame (`1389:14`, approved only) with the design rounds in
  `picker — explorations` (`1389:15`) below it; and the `Components`
  page (`944:15`) — node map in the **ui-figma-source** rule. Design
  values come from the library's variables
  (`get_variable_defs`; each carries its CSS name), never from memory.
- **Rules:** `docs/design-system.md` (`DS §anchor`). Component-specific
  reasoning (sizes, markup notes, why an option won) is in the archived
  design plan's decision log, cited here as `design D<n>`.
- **Behaviour (fixed):** the parent plan's S2 / S2b decisions and the
  done steps 2a / 2b. Changing them is a parent-plan decision.
- **Code today:** `public/components/catalog-dialog.mjs` (the dialog),
  `public/utils/catalog-filter.mjs` (search / filter logic), and the
  functional `@scope (dialog.catalog-dialog)` block at the end of the
  `layout` layer in `public/common/styles.css`. Assets in
  `public/assets/{icons,strokes}/` (DS §assets).
- **Content extremes** (measured 2026-10-27 from `reference/*.json`;
  re-measure if the catalogs change much) — for the check page's fixed
  set (S), card wrapping (part 3) and narrow layouts (part 4):

  | | abilities en / ru | spells en / ru | rituals en |
  | --- | --- | --- | --- |
  | entries | 75 | 49 | 68 |
  | longest name | 35 "Mystical Tradition: Witches' Circle" / 41 "Исключительный Атрибут: Сообразительность" | 19 "Illusory Correction" / 20 "Иллюзорная Коррекция" | 35 "Rite of Opening and Rite of Sealing" |
  | description median / max | 84 / 120 · 84 / 107 | 72 / 90 · 76 / 105 | 144 / 210 |
  | rank text median / p90 / max | 68 / 97 / 137 · 70 / 95 / 139 | 68 / 88 / 113 | — (untiered) |
  | effects per rank | 1–5, median 1 | 1–3 | — |

  `acrobatics` carries every field at once (starting equipment, a check
  attribute, a reaction) — a good "everything" sample.

## Goals

1. The dialog matches the approved `picker` frames for traits, talents
   and rituals, at every layout (DS §responsive): two columns, slim
   aside, one column, short windows, plus touch.
2. A card skeleton per catalog, so the real card renderers (parent
   steps 4 / 5, Chunk I step 4 for rituals) land pre-styled.
3. The behaviour the design adds (below) works and is tested.
4. One cheap way to check every catalog × layout after a CSS change.

## Non-goals

- The real trait / talent / ritual card renderers and their data wiring
  (parent steps 4 / 5; Chunk I step 4).
- The rest of the sheet and the other pages (roadmap Phase 8 "Visual
  redesign"); the drawings, which replace placeholders later (DS §assets).
- Russian strings (roadmap l10n item); Remember / Recall as a feature
  (roadmap item, `TODO(trait-recall)`); the weapons / armor dialog (S2-11).

## Behaviour the design adds

Moved from the parent's step 2c:

- **Messages** (design D19): the loader shows only after ~300 ms of
  pending `entries`, with "Loading…" announced but not shown. No matches
  gains **Clear filters**, which empties the search and unchecks every
  chip (focus moves to the search field, as Retry does). Texts: "Couldn't
  load the list." / "Nothing left to learn here." / "Nothing matches." /
  "Select a rank to see it here." (the last caller-tunable for untiered
  catalogs).
- **Counter projection** (design D13, D24): while a rank is selected the
  header counter shows old → new balance. The parent's `header` option is
  a static node, so projecting needs a re-render on selection change
  (e.g. `header?: Node | (selection) → Node`).
- **Search clear ✕** is a scripted button, inert and grey while the field
  is empty (design D25, kept by D29) — not the native cancel control.

## Open items

- **S. Check page.** A dev-only page rendering the picker for every
  catalog at every layout side by side, so one CSS edit + one look covers
  the matrix. Layouts switch on the window size, so each layout needs
  its own iframe at that size (e.g. 1200, 800, 700, 360 wide, and a
  short window). To settle in part 0:
  - where it lives and how it stays out of production (`src/lib/config.mts`
    already has `isDev`), or a Playwright script that screenshots each
    size instead of a page;
  - which entries it shows: the live catalogs from the API, or a small
    fixed set covering every state (selected, blocked, outside
    traditions, long names);
  - the parent's S2-9 chose "no harness file" for step 2; this is a new
    dev surface and needs the user's approval.
- **F. Tradition chips** (design D31). Dropped from traits and rituals
  for now; revisit in part 2 with the real space and a feel for how
  search alone works. `Molecules/Filter group` keeps its tradition kinds
  until then.
- **Chip hover** (design D10): never drawn; settle in the browser in
  part 2.
- **Counter markup and motion** (design D24): one cross-fading element or
  two (old slides left, "→ new" fades in). The choice follows the markup;
  settle in part 1.
- **Tooltip route** (design D17): Popover API + CSS anchor positioning;
  check `popover="hint"` / `interestfor` support when the tooltip is
  built.
- **Long Traditions value** in the 192 preview card (design D34): wrap or
  truncate (Figma truncates, keeping the mark); settle in part 3.
- **Browser results back into Figma.** When a browser round changes the
  look, the agent proposes the matching Figma change; it writes only
  when the user asks (**ui-figma-source**).

## Decisions log

- _(none yet)_

## Steps

Each part is its own commit and confirmation stop: the agent builds,
checks in the browser (**ui-browser-verify**), and hands over
screenshots; the user reviews and commits.

- **Part 0 — Check page.** Settle open item S and build it. **Done
  when:** one look shows every catalog at every layout (or the agreed
  substitute), and it cannot reach production.
- **Part 1 — Base.** The dialog's own `@layer`ed, `@scope`d stylesheet
  with native nesting (**styling** rule; the functional block in
  `styles.css` moves there; the global-leak
  neutralizers stay until the old global rules are fixed), design values
  mapped to `:root` custom properties, surface and `::backdrop`, header
  (title, counter, ✕), columns and the list | aside divider, footer
  (status line, Cancel, primary). **Done when:** the two-column frame
  matches at 1200 for all three catalogs, empty list.
- **Part 2 — Aside.** Search with the scripted ✕, filter chips (strokes
  from `strokes/`, chip hover settled), preview frame and hint, Remember
  / Recall stubs, the messages and their behaviour. **Done when:** the
  aside matches, Clear filters and the delayed loader work and are
  tested, open item F is decided.
- **Part 3 — Card skeletons.** Entry markup and styles per catalog: name,
  meta and action lines, description, rank row (three tiers for traits,
  levels for talents, none for rituals), selected rank, blocked state,
  outside-traditions badge; the compact preview card. **Done when:**
  each catalog's list and preview match the frames on the check page.
- **Part 4 — Layouts.** Slim aside, one column, short windows, touch and
  the on-screen keyboard (DS §responsive; design D32, D33). **Done
  when:** every layout matches its frame, 320 px reflows, nothing
  scrolls sideways.
- **Part 5 — States and motion.** Hover, `:focus-visible` (focus
  underlines), selected, disabled across every control; open / close
  with `@starting-style`; counter motion; everything instant under
  `prefers-reduced-motion` (DS §motion, DS §focus). **Done when:** a
  keyboard-only run reaches and shows every control; reduced motion
  turns the animation off.
- **Close-out.** The parent's step-2c gate below passes; the parent's
  Progress ticks step 2c; this plan moves to `done/`.

## Verification

The parent's step-2c gate, owned here:

- screenshots at desktop and narrow widths, reviewed by the user against
  the `picker` frames;
- a keyboard-only run through every control shows focus;
- reduced motion disables the animation;
- the 2a / 2b paths still pass (S2-9 browser checks);
- `npm run typecheck` clean; `npm test` green.

## References to sweep on completion

- _(none yet)_ — `TODO(trait-recall)` in `catalog-dialog.mjs` cites the
  roadmap item, not this plan, and stays.

## Progress

- [ ] Part 0 — Check page
- [ ] Part 1 — Base
- [ ] Part 2 — Aside
- [ ] Part 3 — Card skeletons
- [ ] Part 4 — Layouts
- [ ] Part 5 — States and motion
- [ ] Close-out
