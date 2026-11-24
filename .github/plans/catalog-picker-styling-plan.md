# Plan — Catalog picker: styling (design → code)

**Status:** active — Part 0 complete (2026-11-17). Part 1 complete
(2026-11-20). Part 2 complete (2026-11-23).
Part 3a complete (2026-11-24); Part 3 continues with 3b.
Open items S and F are resolved.
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
  `@layer picker` / `@scope (dialog.catalog-dialog)` stylesheet at
  `public/common/picker.css`. Assets in
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
- **F. Tradition chips** (design D31). ✅ _Resolved 2026-11-22._
  Keep source chips only: Ability / Spell for traits, Boon / Sin for
  talents, none for rituals. Neither "My traditions" nor individual
  tradition chips are added; tradition tags remain searchable.
  `Molecules/Filter group` keeps its unused tradition kinds.
- **Chip hover** (design D10). ✅ _Resolved 2026-11-22._
  Rotate the caption by 4° from its stable per-chip tilt; keep the
  stroke and ink unchanged. Only real hover triggers it, and reduced
  motion makes the change instant.
- **Counter markup and motion** (design D24): one cross-fading element or
  two (old slides left, "→ new" fades in). The choice follows the markup;
  settle in part 1.
- **Tooltip route** (design D17): Popover API + CSS anchor positioning;
  check `popover="hint"` / `interestfor` support in part 3 and choose
  the implementation that meets the agreed hover / focus / touch
  behaviour.
- **Long Traditions value** in the 192 preview card (design D34): wrap or
  truncate (Figma truncates, keeping the mark); settle in part 3.
- **Search focus across refocus** (exploration, raised by the user
  2026-11-23); settle in 5b. Keep the refocus behaviour, but let the
  focused search look persist through quick actions. Every control that
  hands focus back to search does so on `click`: the ✕ clear, mouse chip
  clicks, Clear filters and Retry. Between `mousedown` and `click` the
  field blurs, so its focused look (taller field, raised label, accent
  rule, active fill) drops and returns. Today it snaps. Once 5b animates
  search focus, each such click would replay the collapse / expand.
  - **Option 1: delay the collapse** (the user's suggestion). Only the
    unfocused rule carries a short `transition-delay` (~100–150 ms); the
    focused rule has none. Focusing stays instant, and a refocus inside
    the window cancels the pending collapse. CSS-only. Caveats: every
    focus-driven property needs the delayed transition (field height,
    label position, rule and fill colours, icon margins);
    `--search-height` needs `@property`, or the transitions go on
    `block-size` / `inset-block-end` directly. A press held past the
    delay still replays it, and a real blur lags by the delay. DS
    §motion stops every transition under reduced motion, so a
    delay-only transition needs a DS note there or the snap returns.
  - **Option 2: keep focus from leaving.** Call `preventDefault()` on a
    mouse `mousedown` over those controls. The field never blurs; the
    click still clears / toggles / retries, and the existing refocus
    still covers focus arriving from elsewhere. Touch and keyboard keep
    native focus, as now. This removes the cause, so long presses,
    reduced motion and real blurs need nothing extra. Caveats: gate on
    the pointer type, because touch also fires a compatibility
    `mousedown`. Firefox drops `:active` after a prevented `mousedown`,
    which matters if the 5b pressed wobble keys on `:active`.
  - **Option 3: sticky engaged state.** A scripted `data-*` flag is set
    on focus and cleared on `focusout` only when focus leaves the aside.
    This is the most flexible option, but it adds state to keep in sync.
    Use it only if options 1–2 fall short.
  - **Agent's lean:** use option 2 as the fix. Add a short collapse
    delay (option 1) only if real focus moves still feel abrupt.
- **Browser results back into Figma.** When a browser round changes the
  look, the agent proposes the matching Figma change; it writes only
  when the user asks (**ui-figma-source**).
  ✅ _Synced 2026-11-22 at the user's request._
  `Atoms/Search input` (`1460:31`), State = Focused (`1460:41`):
  the grey `Clear` instance (`1598:3337`) moved up 8 px to align with the
  search glyph, as the enabled clear already does. The component
  description now records the scripted clear and mouse-only chip-refocus
  behavior instead of the old native-clear / trial wording.
  ✅ _Synced 2026-11-24 at the user's request._
  `Organisms/Trait entry` (`1573:2144`) gained a `Meta` boolean
  property (on by default), bound to each variant's `Meta` frame
  (`1612:3362`–`1612:3365`). The Russian long-name example (`1574:1669`)
  turns it off, so its empty 46 px frame and 8 px gap are gone (card
  425 → 371 px). The set description and the sheet caption (`1573:1058`)
  list the property.

  Follow-up Figma readback (2026-11-24) confirmed the saved property
  bindings on all four variants and these instance measurements:

  | Instance | `Meta` | Header height | Ranks start |
  | --- | --- | --- | --- |
  | Russian long-name example (`1574:1669`) | Off | 65 px | 89 px |
  | Approved Acrobatics (`1646:9586`) | On | 119 px | 143 px |
  | Approved Anathema (`1646:9587`) | On | 119 px | 143 px |

  The no-meta example retains only the intended 24 px header-to-ranks
  gap. Both metadata-bearing references retain their 46 px metadata
  group, two visible rows and original header geometry. Figma exports
  were also visually checked: [no-meta example](../../.playwright-mcp/3a-figma-readback-no-meta.png)
  and [Acrobatics](../../.playwright-mcp/3a-figma-readback-acrobatics.png)
  (local, gitignored; the latter is clipped at the enclosing scrollport,
  but shows the complete header).

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
- **2026-11-19 — Token names fixed in Figma.** Every `Semantic` variable
  now carries its own `var(--<group>-<name>)` WEB code syntax (DS
  §tokens); before, 16 mirrored their primitive's name, 6 carried a
  stale one and 11 had none, so `get_variable_defs` collapsed roles
  into one key. `Opacity/disabled` became `var(--opacity-disabled)`.
  Primitive values already matched the CSS.
- **2026-11-19 — Picker stylesheet: own file, own layer.** New
  `public/common/picker.css`, loaded by a `<link>` right after
  `styles.css` in `public/index.html` and the gallery's `frame.html`.
  The whole file sits in a `picker` layer, appended to the layer
  statement on `styles.css` line 1 so it outranks every old layer.
  Inside the dialog, a `picker.reset` sublayer uses `all: revert` (not
  `revert-layer`, which would fall back to the old layers) to drop the
  old global rules, replacing the leak neutralizers; this also fixes the
  narrow-width leak where the old `media` layer hides the picker header.
  New semantic and type tokens and the breakpoints live only in the new
  file; primitives stay in the old `:root`. Type tokens get new names,
  since `all` does not reset custom properties and the old ones are
  redefined at ≤ 900 px. The old file changes only by the layer name
  and the moved picker block; where an old rule still leaks through,
  commenting it out is the fallback. The file merges into the new main
  stylesheet when the global CSS is refactored. Rejected: `@import`
  (serial download), CSS module scripts (no Safari support) and a
  script-injected `<link>` (unstyled first open).
- **2026-11-19 — Length and type token names deferred.** The `:root`
  semantic tokens stay in `picker.css` and move with the file into the
  new main stylesheet. `picker.css` keeps the old length names, which
  Figma also uses (`--block-outer-pad`, `--md-crns`, …), and temporary
  `--picker-type-*` type names. Reusable names for lengths and other
  non-colour tokens, in CSS and Figma together, belong to the roadmap's
  "Design-token system rework" item; this plan does not rename them.
- **2026-11-22 — Source-only filters and rotation hover approved.**
  Keep the approved source groups and search-only tradition narrowing;
  use caption rotation rather than scale for chip hover. Open item F
  and the hover choice are resolved. Search clear resets only the query,
  not checked chips; the separate Clear filters action remains in 2b.
- **2026-11-22 — Browser review: clear alignment and chip focus.**
  Both clear states follow the search glyph when the field gains focus;
  the lower empty-focused mark was a Figma-variant inconsistency, not
  intentional behavior. Mouse chip activation returns focus to search;
  keyboard and touch activation keep native focus behavior.
- **2026-11-22 — Search component synced in Figma.**
  The user requested the matching design update. Raised the focused
  disabled clear mark and updated the component description to the
  approved clear / focus contract; the other three variants are unchanged.
- **2026-11-24 — Empty trait metadata collapses.** The user chose the
  browser's layout over the reserved empty `Meta` slot in Figma's
  long-name example: an entry without meta lines drops the group and its
  gap. Figma was synced the same day (see "Browser results back into
  Figma" above).

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
  `styles.css` moves there; a reset sublayer replaces the global-leak
  neutralizers — Decisions log 2026-11-19), design values mapped to
  custom properties in that file, surface and `::backdrop`, header
  (title, counter, ✕), columns and the list | aside divider, footer
  (status line, Cancel, primary). Define and implement the dynamic
  header and selection-status options; preserve existing static-header
  callers and commit guards. **Done when:** the empty-list two-column
  shell matches the 1200-wide design for all three catalogs at the
  recorded viewport, and fixture selections exercise counter projection
  and Empty / Ready / Blocked footer content.
  > ✅ **Completed 2026-11-20.**
  > Divergences from the text above: none beyond those recorded under 1b.
  - **1a — Stylesheet, tokens and desktop shell.** Create
    `public/common/picker.css` (layer, reset and loading per the
    Decisions log), move the dialog block there, map the design tokens,
    and style the surface, backdrop,
    header, columns, divider and footer shell with static content.
    **Done when:** all three empty-list desktop shells match their frames;
    stylesheet loading preserves the existing picker behaviour.
    > ✅ **Completed 2026-11-19.**
    > Divergences from the text above: none.
  - **1b — Counter and footer status.** Settle the counter markup and
    implement dynamic header / selection-status options with fixtures.
    Keep static-header compatibility and `canCommit` guards; animation
    waits for 5b. **Done when:** selection updates old → new balance and
    Empty / Ready / Blocked status for all three catalogs without
    introducing pricing logic.
    > ✅ **Completed 2026-11-20.**
    > Divergences from the text above: keeping static-header
    > compatibility needed a fix in dialog code that predates this plan.
    > The status line, commit button and search input were found with
    > unscoped lookups, so a caller header with its own `<output>` took
    > every status update; the lookups are now scoped to their regions.
    > Counter and status use fixed gallery snapshots; no pricing logic.
    > Review also found the header and footer clipped below 572 px and the
    > status wrapping at phone widths; both belong to 4a.
- **Part 2 — Aside.** Search with the scripted ✕, filter chips (strokes
  from `strokes/`, chip hover settled), preview frame and hint, Remember
  / Recall stubs, the messages and their behaviour. **Done when:** the
  aside matches, Clear filters and the delayed loader work and are
  tested, open item F is decided.
  > ✅ **Completed 2026-11-23.**
  > Divergences from the text above: none beyond those recorded under 2a
  > and 2b. The user's manual browser review of 2b passed, and 2b was
  > committed. Compact preview content is owned by 3d, responsive
  > layouts by part 4, and the remaining state / motion work by part 5.
  - **2a — Search and filters.** Style the search field and scripted
    clear button, build the chip presentation, settle chip hover and
    open item F. **Done when:** search and filter controls match the
    desktop design and work by pointer and keyboard; the clear button
    is inert while the search is empty.
    > ✅ **Completed 2026-11-22.**
    > Divergences from the text above: browser review aligned the disabled
    > clear with the focused search glyph instead of keeping the Figma
    > variant's lower position; Figma was synced on 2026-11-22.
    > Mouse chip activation now refocuses search, while keyboard and touch
    > keep native focus behavior. The optional
    > `search.placeholder` supplies a caller's display-only hint;
    > without it the hint is "Type to search". Chip and focus-underline
    > SVG masks opt out of aspect-ratio preservation so they stretch
    > with the caption; the placeholder drawings themselves are unchanged.
    > Search / chip keyboard focus and hover are included here. The
    > remaining state transitions, check / uncheck wipe and pressed
    > wobble belong to 5b.
  - **2b — Preview area and messages.** Style the preview frame / hint
    and Remember / Recall stubs; implement the delayed loader and
    loading / error / empty / no-matches messages. **Done when:** Retry
    restores entries, Clear filters resets both search and chips, both
    actions focus search, and the loader delay / announcements are
    tested. The real compact preview content follows in 3d.
    > ✅ **Completed 2026-11-23.**
    > Divergences from the text above: none. The preview slot is 192 px
    > when selected; the full-width hint is caller-tunable via
    > `previewHint`. The Compare divider ships, but the design-only tray
    > and artwork placeholder do not. Loading and quiet-message
    > announcements use a persistent live status outside the busy list;
    > loader timers are cancelled on settlement and close. Retry and
    > Clear filters have plain-button hover / keyboard focus, and the
    > loader has a static reduced-motion frame.
    >
    > Browser checks used Chrome Canary, including the exact 299 / 300 ms
    > boundary, cached / fast loads, rejection and retry, late settlement
    > after close, initial filters across multiple groups, and preserved
    > selection after clearing. All three catalogs were checked at
    > 1264 × 864 (1200 × 800 dialog, 410 px aside). Clear filters also
    > worked at 800 × 864 and 844 × 390; those retain the existing desktop
    > geometry / scrolling until 4a, not the approved responsive layouts.
    > Live-region DOM and accessibility snapshots were checked; this was
    > not an audible screen-reader session. Real compact preview markup
    > still follows in 3d.
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

    > ✅ **Completed 2026-11-24.**
    > Divergences from the text above: reusable `renderTraitEntry` in
    > `public/components/catalog-entry.mjs` drives the trait gallery,
    > including Street Fighting's special attack and Witches' Circle's
    > long-content case. Fixture text and actions are checked against the
    > reference tiers; prices and availability remain fixture-supplied.
    >
    > - The user approved collapsing the empty metadata group, as the
    >   Witches' Circle card does in the browser, over the reserved slot in
    >   Figma's long-name example. Figma now follows the browser through
    >   the new `Meta` property (synced 2026-11-24, see "Browser results
    >   back into Figma"); DS §controls records the rule.
    > - Unavailable ranks use `aria-disabled`, not native `disabled`,
    >   as specified by design D16; DS §focus now records the exception.
    >   The gallery uses "not at creation", not an affordability reason
    >   contradicting its 70 XP balance.
    > - Dividers appear between visible entries only, not after the
    >   last one (design D21). The rank-name focus underline follows the
    >   text box, about 1.6 px below Figma's fixed offset.
    > - The list now reserves its scrollbar gutter (DS §controls):
    >   filtering a tall list to a single short card no longer widens
    >   the card and rewraps its text.
    > - Action descriptions and the outside-traditions tooltip remain
    >   in **3d**; compact previews are still stand-ins. Russian strings
    >   remain outside this plan. No domain formatting or pricing was added.
    >
    > Part 3 stays open for **3b–3d**.

    Browser verification (Chrome Canary, 2026-11-24): 1264 × 864 viewport,
    1200 × 800 dialog. Acrobatics (`1646:9586`) has a 118.8 px header
    against Figma's 119 px, ranks 132.8 / 140.8 / 169.8 px against
    133 / 141 / 170 px, and total content 586.2 px against 587 px
    (excluding the divider). Card width is 657.2 px against 658 px and
    stays unchanged by filtering. Witches' Circle is 437.2 px tall,
    without clipped or overflowing text. Like Figma's synced Russian
    long-name example, it has no metadata group, though the two cards'
    content differs. Anathema's spell colours, 32 px grade discs and
    16 × 21 px outside-traditions mark were checked.
    Tab reaches unavailable Master and its reason; Enter, Space and
    clicks leave the selected Adept unchanged. Keyboard selection restores
    focus; body clicks also select available ranks. Reduced motion removes
    the hover transition. Filtering, Clear filters, blocked commit and
    the talent / ritual stand-ins also passed.

    Local review captures (gitignored, not regression baselines):
    [desktop](../../.playwright-mcp/3a-review-desktop.png),
    [Acrobatics lower content](../../.playwright-mcp/3a-review-acrobatics-bottom.png),
    [Witches' Circle](../../.playwright-mcp/3a-review-witches-circle.png),
    [Anathema](../../.playwright-mcp/3a-review-anathema.png),
    [Street Fighting](../../.playwright-mcp/3a-review-street-fighting.png).

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
    counter motion using the settled markup; finish search focus / clear
    state transitions (settling open item "Search focus across
    refocus"), the chip check / uncheck wipe and pressed wobble.
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

- `TODO(picker-tooltips)` in `public/components/catalog-entry.mjs`:
  `ActionLine.description` and the outside-traditions mark in
  `renderMeta`; implement and remove both in **3d**.
- `TODO(trait-recall)` in `catalog-dialog.mjs` cites the roadmap item,
  not this plan, and stays.

## Progress

- [x] Part 0 — Check page
- [x] Part 1 — Base
  - [x] 1a — Stylesheet, tokens and desktop shell
  - [x] 1b — Counter and footer status
- [x] Part 2 — Aside
  - [x] 2a — Search and filters
  - [x] 2b — Preview area and messages
- [ ] Part 3 — Card skeletons
  - [x] 3a — Trait cards
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
