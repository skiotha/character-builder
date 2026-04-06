---
applyTo: "**/*.css"
---

### CSS (ADR-012)

- Native platform widgets over custom JS: `<dialog>`, `<details>/<summary>`, Popover API, customizable `<select>` (`appearance: base-select`)
- CSS layers via `@layer` — separate concerns (reset, base, layout, theme, animation, responsive) in a fixed cascade order
- Use `@scope` for component-level isolation instead of BEM prefixes
- Use CSS native nesting — no flat repeated parent selectors
- Selectors: type-based + nesting by default. Classes for shared visuals (`.input`, `.stat`) or JS behavior hooks (`.editable`). IDs for unique styled entities
- No utility classes (`.flex`, `.mt-4`, etc.)
- Modern CSS features freely used: `oklch()`, anchor positioning, `@starting-style`, view transitions, container queries, `@property`, subgrid
- Interactive elements must be visually distinct (hover/focus states, color-coding, cursor) with clean microanimations
- All interactive elements must be keyboard-operable with visible focus styles
- Existing stylesheets predate ADR-012 and are not reference implementations — do not assume current patterns are correct
