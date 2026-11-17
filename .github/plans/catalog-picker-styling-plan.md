# Plan — Catalog picker: styling (design → code)

**Status:** active — Part 0 complete (2026-11-17); awaiting user review
before Part 1a. Open item S is resolved.
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
2. Reusable presentation markup and styles for each catalog's entries
   and compact previews, exercised with fixture inputs rather than
   disposable gallery-only markup. Later callers reuse this presentation
   code when connecting real data (parent steps 4 / 5, Chunk I step 4).
3. The behaviour the design adds (below) works and is tested.
4. One cheap way to check every catalog × layout after a CSS change.

## Non-goals

- Catalog-to-presentation formatting, real eligibility / pricing
  calculations, character-state integration and saving (parent steps
  3 / 4 / 5; Chunk I step 4). Fixtures supply display values and
  availability states; the presentation code does not duplicate those
  domain rules.
- Live character updates while the picker is open. Styling uses frozen
  inputs; the final freshness policy remains a parent-plan obligation
  (review follow-up 2), not a permanent deferral agreed here.
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
- **Selection status** (design D18): add a caller-supplied way to describe
  the selection, alongside the dynamic header. The footer has Empty
  (caller-tunable hint), Ready (name, rank / level where applicable,
  cost / gain / free) and Blocked (`canCommit` reason) states. Preserve
  the live `<output>` semantics and `canCommit` as the commit guard;
  presentation does not calculate prices. Settle the API shape in part 1.
- **Search clear ✕** is a scripted button, inert and grey while the field
  is empty (design D25, kept by D29) — not the native cancel control.
- **Responsive interactions** (design D32): the filter toggle and active
  chip count, footer-triggered preview popover, touch autofocus exception
  and keyboard Search action are behaviour, not just CSS. Part 4 owns
  them; tooltips belong to part 3.

## Open items

- **S. Check page.** ✅ _Resolved 2026-11-17._ A dev-only page rendering the picker for every
  catalog at every layout side by side, so one CSS edit + one look covers
  the matrix. Layouts switch on the window size, so each layout needs
  its own iframe viewport. A small, purpose-built story gallery was
  approved on 2026-11-17, not the Storybook package or a general
  component explorer. This amends the parent's S2-9 "no harness file"
  choice for step 2c.
  - **Data:** fixed representative fixtures based on real catalog
    entries, plus clearly identified edge cases. They are refreshed
    deliberately, not fetched from live catalogs on each load.
    Loading / failure states and balances are controlled scenarios;
    fixtures are test specimens, not another source of RPG rules.
  - **Location / serving:** gallery-only files live in a dedicated,
    version-controlled folder outside `public/`. The existing server
    serves them through a dev-only route during normal `npm run start:dev`;
    no separate server or build is needed. Production returns 404 for
    gallery and fixture URLs, including direct-file requests, rather than
    merely hiding a link or falling through to the SPA. Exact folder /
    route names are implementation details for part 0.
  Record viewport width **and height** separately from the expected
  dialog dimensions. The Figma `1200` desktop shell is not a 1200-wide
  browser viewport: design D23's 32 px outer gutters require at least
  1264 px; its 800 px shell height needs 864 px of viewport height.
  The matrix covers desktop, slim aside, floating one-column, 360 and
  320 px phones, and the 844 × 390 short-window case. Map each frame to
  its viewport before comparing; exact breakpoint thresholds settle
  in part 4.
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
  check `popover="hint"` / `interestfor` support in part 3 and choose
  the implementation that meets the agreed hover / focus / touch
  behaviour.
- **Long Traditions value** in the 192 preview card (design D34): wrap or
  truncate (Figma truncates, keeping the mark); settle in part 3.
- **Browser results back into Figma.** When a browser round changes the
  look, the agent proposes the matching Figma change; it writes only
  when the user asks (**ui-figma-source**).

## Decisions log

- **2026-11-17 — Skeleton boundary approved.** Reusable presentation
  code, not disposable demo markup; fixtures exercise its states.
  Real formatting, eligibility, pricing and saving stay with the
  later integration steps listed under Non-goals.
- **2026-11-17 — Frozen inputs for styling approved.** The Over counter
  and Blocked footer can be demonstrated with fixtures. That does not
  implement D24's external-balance-change scenario or decide the final
  freshness policy; the parent plan explicitly tracks the gap.
- **2026-11-17 — Readiness tightening approved.** Add selection-status
  plumbing, assign tooltip / responsive interactions to parts, and
  verify viewport-to-dialog dimensions explicitly.
- **2026-11-17 — Gallery approved.** One interactive gallery page with
  separate iframe viewports, using the real picker code; no Storybook
  dependency.
- **2026-11-17 — Gallery data and serving approved; S resolved.** Fixed
  representative fixtures with explicit edge cases; gallery-only files
  outside `public/`, served through the existing development server
  during normal `npm run start:dev`. Production refuses the gallery and
  fixture URLs. No character writes or separate gallery server.
- **2026-11-17 — Smaller implementation stops approved.** Keep parts
  1–5 and their scope, but split them into the lettered substeps below.
  Each substep gets its own browser review and user commit; completing a
  substep does not mark its parent part complete.

## Steps

Each lettered substep is its own commit and confirmation stop: the agent
builds, checks in the browser (**ui-browser-verify**), and hands over
screenshots; the user reviews and commits. Part 0 and Close-out remain
standalone stops. Parent parts stay open until all their substeps and
their overall **Done when** gate pass; while only some substeps have
landed, record **⏳ Partial** with an explicit list of the remaining
substeps. Substeps run in the listed order.

- **Part 0 — Check page.** Build the gallery agreed under S, without
  character writes. Start with the existing dialog
  and minimal fixture callbacks; parts 1–4 progressively connect their
  real presentation and behaviour, rather than building a second styled
  implementation here. Prepare reproducible cases for loading / error /
  retry / empty / no matches, selection and included tiers, unavailable
  ranks, boon costs / sin gains, ritual capacity, outside-traditions
  badges and long content. Record the viewport-to-dialog matrix.
  **Done when:** the gallery can open each catalog at each target viewport;
  visual fidelity and newly added behaviour are verified in their owning
  parts, not claimed complete here. A production-mode test proves both
  the page and its supporting fixture files are inaccessible, including
  direct static-file URLs.
  > ✅ **Completed 2026-11-17.**
  > Divergences from the text above: none. Talent cost / gain labels are
  > fixed display-only fixture values; no pricing calculations, reusable
  > card presentation, or character writes were added in this part.
- **Part 1 — Base.** The dialog's own `@layer`ed, `@scope`d stylesheet
  with native nesting (**styling** rule; the functional block in
  `styles.css` moves there; the global-leak
  neutralizers stay until the old global rules are fixed), design values
  mapped to `:root` custom properties, surface and `::backdrop`, header
  (title, counter, ✕), columns and the list | aside divider, footer
  (status line, Cancel, primary). Define and implement the dynamic
  header and selection-status options; preserve existing static-header
  callers and commit guards. **Done when:** the empty-list two-column
  shell matches the 1200-wide design for all three catalogs at the
  recorded viewport, and fixture selections exercise counter projection
  and Empty / Ready / Blocked footer content.
  - **1a — Stylesheet, tokens and desktop shell.** Extract the dialog
    stylesheet, map the design tokens, and style the surface, backdrop,
    header, columns, divider and footer shell with static content.
    **Done when:** all three empty-list desktop shells match their frames;
    stylesheet loading preserves the existing picker behaviour.
  - **1b — Counter and footer status.** Settle the counter markup and
    implement dynamic header / selection-status options with fixtures.
    Keep static-header compatibility and `canCommit` guards; animation
    waits for 5b. **Done when:** selection updates old → new balance and
    Empty / Ready / Blocked status for all three catalogs without
    introducing pricing logic.
- **Part 2 — Aside.** Search with the scripted ✕, filter chips (strokes
  from `strokes/`, chip hover settled), preview frame and hint, Remember
  / Recall stubs, the messages and their behaviour. **Done when:** the
  aside matches, Clear filters and the delayed loader work and are
  tested, open item F is decided.
  - **2a — Search and filters.** Style the search field and scripted
    clear button, build the chip presentation, settle chip hover and
    open item F. **Done when:** search and filter controls match the
    desktop design and work by pointer and keyboard; the clear button
    is inert while the search is empty.
  - **2b — Preview area and messages.** Style the preview frame / hint
    and Remember / Recall stubs; implement the delayed loader and
    loading / error / empty / no-matches messages. **Done when:** Retry
    restores entries, Clear filters resets both search and chips, both
    actions focus search, and the loader delay / announcements are
    tested. The real compact preview content follows in 3d.
- **Part 3 — Card skeletons.** Reusable entry markup and styles per
  catalog: name, meta and action lines, description, rank blocks (three
  stacked tiers for traits, levels for talents, none for rituals),
  selected / included ranks, unavailable states, outside-traditions
  badge; the compact preview card. Wire selection callbacks and respect
  fixture-supplied availability without implementing domain rules.
  Build the short-content tooltips (design D17, D34); authored term
  markers remain the parent's separate step-4 task. Settle long
  Traditions wrapping / truncation. **Done when:** each catalog's list
  and preview match the frames using the reusable presentation code;
  unavailable ranks remain readable and focusable but cannot be selected;
  tooltips open on hover / focus / tap, stay while hovered and dismiss
  with Escape without closing the picker.
  - **3a — Trait cards.** Build reusable trait presentation, including
    the stacked ranks, selected / included / unavailable states,
    action and meta lines, and outside-traditions badge.
    **Done when:** the representative and long-content fixtures match
    the trait frames; unavailable ranks remain focusable but cannot
    be selected.
  - **3b — Talent cards.** Build reusable boon / sin presentation with
    level selection and fixture-supplied cost / gain text.
    **Done when:** both sources match their frames and selecting levels
    updates the card state without calculating prices.
  - **3c — Ritual cards.** Build reusable untiered presentation with
    traditions, availability and long-content cases.
    **Done when:** ritual fixtures match their frames and selection /
    capacity-blocked cases work without domain calculations.
  - **3d — Compact previews and tooltips.** Build the real compact
    previews for all three catalogs, settle long Traditions text and
    the tooltip implementation. **Done when:** previews match the
    frames; tooltips work on hover / focus / tap, remain while hovered,
    and dismiss independently of the picker with Escape.
- **Part 4 — Layouts.** Slim aside, one column, short windows, touch and
  the on-screen keyboard (DS §responsive; design D32, D33). Implement
  the filter toggle with active-chip count and accessible name, the
  footer-triggered preview popover, no search autofocus on touch, and
  the keyboard's Search action moving focus to the first result.
  Preserve selection and filter state across layout changes; keep hidden
  controls out of the tab order. **Done when:** every layout matches its
  frame at the recorded viewport, 320 px reflows, nothing scrolls sideways;
  toggles and counts work; the preview popover opens and dismisses with
  correct focus restoration, without dismissing the picker; touch targets
  and keyboard behaviour are exercised, not inferred from screenshots.
  - **4a — Responsive geometry.** Implement slim-aside, floating
    one-column, phone and short-window layouts; settle breakpoints.
    **Done when:** every catalog fits each recorded viewport, including
    320 px without sideways scrolling, and resizing preserves selection
    and filters. Interactive collapsible controls follow in 4b.
  - **4b — Filter and preview controls.** Implement the filter toggle,
    active-chip count / accessible name and footer preview popover.
    **Done when:** controls work by pointer and keyboard, hidden
    controls leave the tab order, and dismissing the popover restores
    focus without closing the picker.
  - **4c — Touch and on-screen keyboard.** Implement touch autofocus
    rules and the keyboard's Search action; verify tap targets and
    tooltip taps. **Done when:** touch does not autofocus search, Search
    moves focus to the first result without committing, and the picker
    remains usable with the on-screen keyboard open. Record actual
    touch / keyboard evidence, not just a resized desktop viewport.
- **Part 5 — States and motion.** Hover, `:focus-visible` (focus
  underlines), selected, disabled across every control; open / close
  with `@starting-style`; counter motion; everything instant under
  `prefers-reduced-motion` (DS §motion, DS §focus). **Done when:** a
  keyboard-only run reaches and shows every control; reduced motion
  turns the animation off.
  - **5a — States and focus.** Complete hover, focus-visible, selected
    and disabled presentation across the dialog, cards and popovers.
    **Done when:** the keyboard-only pass reaches every available
    control with visible focus and all relevant states match the design.
  - **5b — Motion and reduced motion.** Add open / close transitions and
    counter motion using the settled markup.
    **Done when:** transitions behave correctly during interaction and
    reduced motion makes them instant without changing selection,
    dismissal or focus behaviour.
- **Close-out.** The parent's step-2c gate below passes; the parent's
  Progress ticks step 2c; this plan moves to `done/`.

## Verification

The parent's step-2c gate, owned here:

- screenshots at desktop and narrow widths, reviewed by the user against
  the `picker` frames, with viewport and dialog dimensions recorded;
- a keyboard-only run through every control shows focus;
- tooltips and preview popovers dismiss independently of the picker,
  with focus preserved / restored as appropriate;
- touch checks cover tap targets, tooltip taps, no search autofocus and
  the on-screen keyboard / Search action; a resized desktop viewport
  alone is not evidence that the keyboard behaviour works;
- reduced motion disables the animation;
- the 2a / 2b paths still pass (S2-9 browser checks);
- frozen-input fixtures do not count as verification of live updates or
  save-time freshness checks; those remain with the parent integration;
- `npm run typecheck` clean; `npm test` green.

## References to sweep on completion

- _(none yet)_ — `TODO(trait-recall)` in `catalog-dialog.mjs` cites the
  roadmap item, not this plan, and stays.

## Progress

- [x] Part 0 — Check page
- [ ] Part 1 — Base
  - [ ] 1a — Stylesheet, tokens and desktop shell
  - [ ] 1b — Counter and footer status
- [ ] Part 2 — Aside
  - [ ] 2a — Search and filters
  - [ ] 2b — Preview area and messages
- [ ] Part 3 — Card skeletons
  - [ ] 3a — Trait cards
  - [ ] 3b — Talent cards
  - [ ] 3c — Ritual cards
  - [ ] 3d — Compact previews and tooltips
- [ ] Part 4 — Layouts
  - [ ] 4a — Responsive geometry
  - [ ] 4b — Filter and preview controls
  - [ ] 4c — Touch and on-screen keyboard
- [ ] Part 5 — States and motion
  - [ ] 5a — States and focus
  - [ ] 5b — Motion and reduced motion
- [ ] Close-out
