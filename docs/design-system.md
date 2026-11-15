# Design System — how the app looks and how its design grows

> The durable rules of the app's visual design. It covers the Figma component
> library, the tokens, motion and states, the responsive model, and the
> hand-drawn assets. The catalog picker was designed with these rules, and
> the page redesign extends them (roadmap, Phase 8 "Visual redesign").
> Audience: the user (design authority) and the agents who draft in Figma
> and implement in CSS.

## How this document works

**Anchors & citing.** Every `DS §<anchor>` entry heading below is a stable
anchor. Cite it from code, ADRs, docs and Figma component descriptions as
`DS §<anchor>`. Renaming an anchor is a breaking change for anything that
cites it. Unlike `ADR-NNN §anchor` and `NB-<n>` cites, `DS` cites are not
lint-enforced.

**What lives elsewhere.**

- The Figma file, page and section ids, the canonical frames, the MCP read
  workflow and the write policy → the **ui-figma-source** scoped rule.
- Token **values** (colours, sizes, type) → Figma variables and the
  `Foundations` sheet. Fetch them live; this document names roles, not
  values.
- HTML and CSS conventions → [ADR-012](decisions/012-standards-first-html-css.md)
  and the **hypertext** / **styling** scoped rules.
- What a view shows and how it behaves → the schema, the ADRs and the
  other `docs/`. Figma owns the look, not the content.

**Keeping it true.** When a design discussion settles a rule that outlives
the current work, the rule is recorded here in the same change. Work plans
keep the reasoning behind each choice; this document keeps the rule.

## Library & workflow

### DS §library — component library

- **Where:** the Figma `Components` page holds one section per layer:
  `Foundations`, `Icons`, `Atoms`, `Molecules` and `Organisms`, each with
  its sheet. An `Explorations` section holds boards that compare options
  for the library itself (e.g. palette candidates).
- **Naming:** slash names by layer, `<Layer>/<Name>` (`Atoms/Button`,
  `Molecules/Tooltip`, `Organisms/Ritual card`). Variant properties are
  named for what they change (`State`, `Size`, `Checked`, `Layout`).
  `Icons/*` holds glyphs. `Decor/*` holds drawn pieces that are not icons
  (button borders, focus underlines, chip strokes, the loader).
- **Built from parts:** a component uses lower-layer instances, never
  copies of them, and binds every colour, spacing, radius and type value
  to a variable or text style (`Semantic` for colours).
- **Descriptions:** every component set carries a description: what it
  is for, its properties, its states, and the code it maps to (element,
  ARIA, CSS hooks). The description is what code reads first, so a change
  to the component updates it in the same edit.
- **Nothing is deleted.** A variant or component that loses a design
  choice is marked **Deprecated** (or **Parked**, while a later step may
  still need it) in its description and with a small label beside it on
  its sheet.
- **Placeholders:** a drawing that doesn't exist yet gets a placeholder
  component of the final slot size, whose art layer the drawing replaces
  (DS §assets). Instances never need re-placing.
- **Extend, don't fork.** A new design reuses library pieces first, adds
  variants or properties second, and builds a new component last. A
  one-off drawn by hand in a draft becomes a component before it reaches
  the canonical frames.

### DS §workflow — design rounds

- **Canonical frames hold approved designs only.** Drafts live in an
  explorations section beside them, one sub-section per round
  (`rN — <theme>`), with frames named `<view> / <width> / rN-<letter>`.
- **Draft → review → record → code.** The agent drafts two to four
  options and screenshots them to catch build errors. The user reviews
  them on the canvas, picks one and may tweak it by hand. The agent
  records the decision. Code follows once a view's layout is settled.
- **Rejected frames stay** in their round, labelled "not chosen".
  State demos (touch, keyboard, edge cases) stay in their round too.
- Approved copies in the canonical frames are built from components, at
  full size, so a component change reaches them.

## Foundations

### DS §tokens — variables and scale

- **Two collections:** `Primitives` (raw values, hidden from pickers) and
  `Semantic` (roles that alias primitives). Components bind only to
  `Semantic`, so the palette can be remapped, or a mode added (e.g. a
  light or inverted one), without redrawing. One mode (`Dark`) today.
- **One name across tools:** every variable carries its CSS custom
  property name as its WEB code syntax, and CSS uses that name.
- **`1rem` = the browser default (16 px).** No root `font-size` tricks
  (no 62.5 %, no viewport clamp), so the reader's font-size setting and
  zoom work. Sizes are authored in rem.
- **A 4 px scale.** Spacing, radii and sizes sit on multiples of 4 px
  (`0.25rem`). Named spacing steps: 8 / 16 / 24 / 32 / 48 / 80, plus a
  tight 4 for rows inside one block.
- **Old CSS values are not binding.** A design may add a token whenever
  the existing ones don't fit, on the 4 px scale, in Figma (`Primitives` /
  `Semantic` and the `Foundations` sheet) and in CSS together.

### DS §palette — one owner per role

Each hue has one job, so colour alone tells the reader what to do with an
element:

- **Yellow** (`Color/Main`) = interactive: buttons, links, field lines,
  live icons, scrollbar thumb.
- **Pale gold** = headings and non-interactive status marks.
- **Ochre** = decoration: frames, squiggles, dividers, rails, the loader,
  tooltip outlines.
- **Red** (`Color/Accent`) = attention only: focus and alerts.
- **Grey** = muted, don't-look-at-me text. **Grey-dim** = disabled.
- **A category pair**, Kind A (verdigris) and Kind B (amethyst), reused
  across catalogs (abilities / boons, spells / sins). Both have equal
  lightness and chroma, so neither outranks the other.

Contrast: text meets WCAG AA (4.5 : 1, or 3 : 1 for large text). Marks
and control boundaries meet 3 : 1. Disabled is exempt. **State never
reads by colour alone** (WCAG 1.4.1): a second cue (shape, a drawing, a
mark, text) always carries it too.

### DS §type — type

- Fonts and the type ramp are text styles (`Fonts/*`) on the `Foundations`
  sheet. Headings step down by role, e.g. dialog title 36 → section
  heading / entry name 28 → card name 22 → rank name 20.
- **English is the primary language**, Russian the second. Captions are
  measured in both, and paired captions should stay close in length.
  Russian copy in drafts is a placeholder the user adapts.
- Button captions are uppercase. **Text a person typed shows
  capitalized** (`text-transform: capitalize`, visual only; matching
  stays case-insensitive), search fields included.
- A placeholder hint appears only while its field is focused, in a style
  that can't be mistaken for an entered value.

## Interaction

### DS §motion — motion and drawn assets in states

- **Drawn SVG assets don't change colour on hover or focus.** Hover →
  rotation and / or scale. Activation → a wobble.
- **Exceptions:** a disabled control turns grey and may swap to a
  "broken" drawing. A colour transition is allowed where colour carries
  the state (e.g. a live vs inert icon).
- **Hand-made tilt:** buttons and chips lean by a small angle (−3°…+3°)
  that is fixed per element (derived from its id, so re-renders don't
  change it). The caption and its drawing lean independently and may
  move by different amounts.
- **Nothing important appears instantly.** Value changes cross-fade or
  slide.
- **`prefers-reduced-motion`:** every transition and animation stops.
  Static end states (a grown glyph, an underline) stay, so no state
  depends on motion.

### DS §focus — focus and states

- **Keyboard focus is always visible, and static:**
  - text buttons and chips → a hand-drawn underline under the caption
    (red; yellow under red captions);
  - icon buttons → the glyph grows (×1.25) inside its click area. Hover
    doesn't scale, so focus can't be mistaken for hover;
  - text fields → the field grows, its top line turns red, and it fills
    yellow with black text.
- **Disabled** controls are natively `disabled` (skipped by Tab, no hover
  motion) and drawn in Grey-dim.
- **Tooltips carry short things only:** a term, a quality, a one-line
  aside. They open on hover **and** focus, stay while hovered, close on
  Esc, and open on tap on touch, so their trigger is a real control.
  **Long content that a choice depends on** goes behind a native
  `<details>` toggle that opens in place, never into a hover tooltip.

### DS §responsive — sizes, touch and short windows

- **Expected use:** the app is used at a desktop with a keyboard. Phones
  and tablets are rare but must never look broken (user, 2026-11-14).
  Informative features (browsing, reading) work everywhere. Features
  that need involved thought (e.g. comparing entries) may stay
  wide-layout only, but **zoom counts as narrow** (WCAG 1.4.10 Reflow:
  1920 px at 200 % is ~960 CSS px). Such a feature needs a narrow
  fallback, designed together with the feature.
- **Layouts by width, found by drawing.** The catalog picker set the
  pattern: two columns from its full width down to ~1000; a slim side
  column down to ~750; one column below. It floats down to ~480 and goes
  full-screen below that (16 px padding, no radius). Exact switch points
  settle in CSS.
- **Headers and tool rows never wrap.** At phone widths, type steps down
  a level, secondary text shortens, and rarely used controls fold behind
  a toggle (e.g. a filter button with a count badge).
- **Short windows** (below ~500 px tall, at any width) get their own
  layout, independent of width: one top bar, everything secondary behind
  toggles or popovers, a one-row footer. A phone held sideways lands
  here.
- **Touch** (`pointer: coarse`): small controls get invisible 44 px tap
  zones and keep their drawn size. A tap opens what hover would. No
  autofocus on touch screens. The on-screen keyboard may cover the
  footer; the layout stays still rather than reflowing around it, and
  the keyboard's "Search" key moves focus to the first result.

### DS §decor — decorative artwork

- Decorative drawings (squiggles, the side-column artwork) are hidden
  from assistive tech (`alt=""` or a CSS background), never focusable,
  and never take pointer events.
- **Unbounded:** a drawing may overflow anywhere: under other elements,
  out of its container, out of the window. A layout area only places its
  centre. In CSS it is an out-of-flow layer (absolute,
  `pointer-events: none`, behind the content) on a box that doesn't clip
  it.
- **It never adds height** and never makes anything scroll. It only fills
  room the layout already has.

## Assets

### DS §assets — hand-drawn assets

The app's look rests on hand-drawn marks and strokes. The user draws them
in Illustrator with artistic brushes. Outlines are not fully predictable,
so the briefs below are briefs, not specs.

**Hand-off.**

1. Illustrator *Export As → SVG*: presentation attributes, outlined text,
   no embedded images, 2 decimals, Responsive on. The user's `.ai`
   sources stay with the user.
2. The agent strips editor ids and metadata, checks the viewBox, and
   replaces baked fills with `currentColor` or a custom property (e.g.
   `var(--icon-secondary)`; grade discs use one property for the disc
   and one for the letter). Custom properties inherit into `<use>`
   shadow trees, so one file serves every colour and the disabled state.
3. The cleaned SVG in the repo is the one shipped copy. Figma imports
   that same file into the asset's placeholder component (DS §library).

**Placeholders ship until a drawing exists.** Each drawing replaces its
placeholder file at the same slot size. Design-only placeholders (dashed
boxes marking an area) ship as nothing. Delivery is tracked by the
roadmap's Phase 8 "Visual redesign" item. When drawings land, one check
round follows, in Figma and in the browser at desktop and narrow widths.

**Briefs.** "Placeholder" = a placeholder component exists in Figma.
"Candidate" = considered during design but unused in the approved
designs (some have a slot that is switched off); draw it only if a later
design adopts it.

| Asset | Role | Brief | State |
| --- | --- | --- | --- |
| Button border | primary button | Draw at 128 × 48; stretches a little for longer captions | placeholder |
| Button border, broken | disabled primary | The same 128 × 48 frame, visibly broken or interrupted; shown grey | placeholder |
| Focus underline | keyboard focus on every text button and chip | A brush stroke under the caption; draw at 112 × 12 (the longest caption, ЗАПОМНИТЬ); squeezes for shorter ones, so add a short version if a 58 px caption looks wrong. Several shapes to vary per caption (count open); red by default, yellow under red captions | placeholder (3 shapes) |
| Chip stroke, unchecked / checked | filter chip fill | One wide brush stroke at S 64 / M 96 / L 128 × 32 (6 drawings). The checked one differs in **shape and angle**, not just colour; the tilt lives inside the canvas; colours come from CSS (grey / yellow) | placeholder |
| Close ✕ | dialog dismiss (24), search clear (24, mirrors the search glyph), card remove (24) | Visual mass centred (it rotates on hover); reads at ~16–28 px; clearly not a "+"; the three may be distinct drawings | placeholder |
| Tick | check mark (16) | Reads at 16 px; no current use (chips mark "checked" by stroke shape); keep for a later sheet checkbox or drop | placeholder |
| Search glyph | search field (24) | Reads at ~20–24 px | placeholder |
| Filter glyph | filter toggle ending a search row (24) | Reads at ~20–24 px as "filter", not "menu"; sits on the icon button | placeholder |
| Alert mark | before a blocked reason (16) | Small red "blocked / attention" mark, readable at 16 px beside Body-14 text; distinct from the outside-traditions mark; colour from CSS | placeholder |
| Outside-traditions mark | spell / ritual badge | Small red mark, readable at ~16 px, meaning "not your tradition"; stands alone, with a tooltip | placeholder (a dot) |
| Special attack / reaction marks | action line kind (16) | Two small marks told apart by shape, readable at 16 px beside Body-14 text; colour from CSS | placeholder |
| Loader | list loading state (48 × 48) | Animated (frames or a rotating / drawing stroke), plus a static frame for reduced motion. It shows **alone** (the text is for screen readers only), so the static frame must still read as "loading" | placeholder |
| Details marker | details toggle (~12) | Small mark beside Body-14; points right when closed and turns (or is redrawn) to point down when open | placeholder |
| Background squiggle | dialog surface decoration | Decorative, behind content; must tolerate cropping at narrow widths (DS §decor) | not drawn, no placeholder |
| Side-column artwork | the free space in a dialog's side column | Decorative (DS §decor). Two areas: beside the preview card in the wide side column (~202 wide, as tall as the heading and card: 293 for trait cards, 117 for talent and ritual cards), and below the card in the slim one (192 wide, 0 to several hundred px tall). The areas only place the drawing's centre; sizes settle once it's drawn | design-only placeholder |
| Spell / ability kind marks | entry kind | A sibling pair (mark, edge or ornament) differing in shape, colour or place; neither kind louder than the other | candidate |
| Equipment / attributes / traditions icons | meta line labels | Small icons that may replace the text labels (e.g. a sword for equipment) | candidate |
| Swap hint mark | entry head | Small mark hinting that a rank lets the character swap an attribute | candidate |
| Applied-by-sheet mark | effect line | Tells "the sheet applies this for you" from "remember this at the table"; one mark on one side, or a sibling pair | candidate |
