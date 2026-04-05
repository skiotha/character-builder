# ADR-012: Standards-First HTML, CSS & Web Platform Conventions

**Status:** Accepted
**Date:** 2026-04-05
**Deciders:** Project owner + Copilot design session

## Context

The character builder is a vanilla SPA with no build step, no CSS framework, and no component library. All markup and styles are hand-authored. With [ADR-009](009-schema-driven-rendering.md) moving to schema-driven client rendering, the form renderer now generates DOM programmatically — making it essential to codify the HTML and CSS conventions that generated markup must follow.

The project targets a small, known user base on modern desktop browsers. There is no requirement to support legacy browsers or degraded rendering modes. This frees the project to adopt current and emerging web platform features without polyfills or fallbacks.

### Alternatives Considered

| Approach | Rejected because |
| --- | --- |
| **Utility-class CSS (Tailwind, UnoCSS)** | Requires a build step (violates ADR-001), produces non-semantic class soup in markup, poor DevTools readability |
| **BEM / SMACSS naming** | Unnecessary ceremony for a project that uses `@scope` and native nesting. Class-heavy selectors add noise without benefit |
| **CSS-in-JS (styled-components, Emotion)** | Requires a runtime or build step, couples styles to a framework, violates zero-dependency constraint |
| **Conservative browser floor (e.g. 2-year baseline)** | Sacrifices cleaner code for compatibility the actual user base does not need. The project is not a public-facing product |

## Decision

**Adopt a standards-first approach to HTML, CSS, and Web Platform APIs.**
Prefer native platform capabilities over libraries, polyfills, or custom implementations. Accept limited browser support (latest stable Chrome, Firefox, Safari) in exchange for cleaner code, less JavaScript, and future-proof markup.

### 1. Semantic HTML

Use the most specific HTML element available for each piece of content. Generic containers (`<div>`, `<span>`) are used only for grouping and layout when no semantic element is a better fit.

- Headings (`<h1>`–`<h4>`), lists (`<dl>`, `<ul>`, `<ol>`), `<section>`, `<article>`, `<nav>`, `<header>`, `<footer>`, `<aside>`, `<figure>`, `<time>`, `<address>`, etc. — all used when semantically appropriate
- Form controls use `<label>` + native `<input>` / `<select>` / `<textarea>` with appropriate `type`, `inputmode`, `autocomplete` attributes
- Field wrapper pattern: a containing element groups a `<label>` with its associated control, used consistently for form layout

### 2. Native Platform Widgets

Prefer built-in HTML elements and APIs over custom JavaScript implementations, even when the native version is experimental or has
limited cross-browser support:

| Need                 | Use                                                 | Not                            |
| -------------------- | --------------------------------------------------- | ------------------------------ |
| Modal dialogs        | `<dialog>` + `.showModal()`                         | Custom overlay + focus trap JS |
| Collapsible sections | `<details>` / `<summary>`                           | Custom accordion JS            |
| Tooltips / popovers  | Popover API (`popover`, `popovertarget`)            | Custom tooltip JS              |
| Dropdowns            | Customizable `<select>` (`appearance: base-select`) | Custom listbox JS              |
| Date/time input      | `<input type="date">`, `<input type="time">`        | Custom date picker             |

When a native widget lacks a needed feature, extend it with minimal JavaScript rather than replacing it entirely.

### 3. Accessibility as Usability

Accessibility is not a compliance checkbox — it is a usability concern. Every interaction must work regardless of input device (mouse, keyboard, touch, assistive technology).

- Logical tab order via document flow; `tabindex` only when flow is insufficient
- All interactive elements are keyboard-operable (Enter, Space, Escape, arrow keys where appropriate)
- Focus is visible and styled intentionally (not suppressed)
- ARIA attributes used where native semantics are insufficient (e.g. `aria-label` on icon-only buttons, `aria-live` for dynamic updates, `role` on custom widgets)
- Color is never the sole indicator of state — pair with icons, text, or shape

### 4. CSS Architecture

#### Layers (`@layer`)

Separate concerns into cascade layers. Layers are declared in a fixed order at the top of the main stylesheet. The specific layer names and responsibilities should be determined during a stylesheet audit, but the general principle is:

- A **reset** layer for box model and normalization
- A **base** layer for custom properties and element defaults
- Functional layers for layout, theming, animation, and responsive behavior

Layers are ordered from lowest to highest priority. Unlayered styles win over all layers.

#### Scope (`@scope`)

Use `@scope` for component-level style isolation. Scoped styles replace the need for BEM-style class prefixes or deeply nested selectors:

```css
@scope (.character-card) {
  h3 { ... }
  .stat { ... }
}
```

#### Native Nesting

Use CSS native nesting for hierarchical styles. Avoids repeating parent selectors and keeps related rules visually grouped:

```css
nav {
  a {
    color: var(--color-main);
    &:hover { text-decoration: underline; }
  }
}
```

#### Selector Strategy

- **Type selectors + nesting** — the default. Target elements by their HTML type within a scoped or nested context
- **Classes** — used for elements with shared visual characteristics across the page (`.input`, `.stat`, `.badge`) or for attaching JavaScript behavior (`.editable`, `.copyable`)
- **IDs** — used for singular entities with distinct styles
- **No utility classes** — no `.flex`, `.mt-4`, `.text-center`. Layout is expressed through meaningful selectors and custom properties
- **Minimal specificity** — rely on cascade layers and scope boundaries rather than specificity escalation

### 5. Modern CSS Features

Adopt modern CSS capabilities when they provide a real benefit:

| Feature                         | Use case                                           |
| ------------------------------- | -------------------------------------------------- |
| `oklch()` / `color-mix()`       | Color definitions, dynamic tints/shades            |
| Anchor positioning              | Tooltips, popovers positioned relative to triggers |
| Scroll-driven animations        | Scroll-linked visual effects                       |
| View transitions                | Page and state transition animations               |
| `@starting-style`               | Entry animations for newly-displayed elements      |
| Container queries               | Component-level responsive layout                  |
| `@property`                     | Typed custom properties with interpolation         |
| `text-wrap: balance` / `pretty` | Typography refinement                              |
| Subgrid                         | Nested alignment with parent grid                  |

### 6. Visual Polish

- Interactive elements are visually distinct from static content (color-coded, cursor changes, hover/focus states)
- State transitions use clean microanimations (opacity, transform, color) — avoid large layout shifts
- Consistent spacing via a structured set of custom properties (e.g. small / medium / large increments)
- Stylesheets remain human-readable and well-structured — DevTools inspection should feel clean, not generated

### 7. Modern JavaScript & Web APIs

When implementing client-side UI features, prefer W3C/WHATWG-approved APIs even if browser support is intermediate:

- Structured Clone, `URL.parse()`, `Array.groupBy()`, `Set` methods
- `navigator.clipboard`, Resize Observer, Intersection Observer
- `element.animate()` (Web Animations API) for programmatic animations
- Import assertions, `structuredClone()`, `AbortSignal.any()`
- View Transitions API for client-side navigation

The same standards-first rationale applies: the user base is on modern browsers, and native APIs are preferred over npm packages.

## Consequences

- **Positive:** Markup and styles are clean, readable, and idiomatic. Anyone inspecting via DevTools sees professional, semantic structure.
- **Positive:** No build step, no framework lock-in, no class-name generation. Styles are authored and served as-is.
- **Positive:** Native widgets get automatic platform improvements (accessibility, mobile behavior, performance) for free as browsers
  evolve.
- **Positive:** The schema-driven renderer ([ADR-009](009-schema-driven-rendering.md)) has explicit DOM conventions to follow, reducing drift between generated and hand-authored markup.
- **Negative:** Some features may not render identically across all browsers. Acceptable given the known user base.
- **Negative:** Developers unfamiliar with modern CSS (`@layer`, `@scope`, native nesting) may need orientation.
- **Negative:** Native widgets offer less visual customization than fully custom implementations. Prefer progressive enhancement — style the native widget before replacing it.

## Follow-Up

The existing stylesheets (`public/common/styles.css` and view-specific styles) predate this ADR and were written without a formal conventions guide. They should not be treated as reference implementations of these principles. A thorough audit of the existing HTML and CSS is planned for Phase 8 (Polish) of the roadmap to bring the codebase into alignment with this decision.
