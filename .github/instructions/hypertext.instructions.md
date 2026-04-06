---
applyTo: "**/*.html, public/components/*.mjs, public/renderers/*.mjs"
---

# HTML & JS instructions (ADR-012)

- Semantic HTML first — use the most specific element (`<section>`, `<nav>`, `<dl>`, `<dialog>`, etc.) before reaching for `<div>` or `<span>`
- Native platform widgets over custom JS: `<dialog>`, `<details>/<summary>`, Popover API, customizable `<select>` (`appearance: base-select`)
- Field wrapper pattern: a containing element groups a `<label>` with its associated control
- Interactive elements must be visually distinct (hover/focus states, color-coding, cursor) with clean microanimations
- All interactive elements must be keyboard-operable with visible focus styles
- Modern JS/Web APIs preferred when W3C/WHATWG-approved, even with intermediate browser support