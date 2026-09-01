---
applyTo: "public/**/*.css, public/**/*.html, public/**/*.mjs"
---

# UI design source (Figma)

Figma file **Ahani.Base** is the design source of truth for the `public/`
redesign — for how things **look** (colors, type, layout, composition),
not for what things **are**. Information architecture, the field
inventory, widget behavior, and data shapes are owned by the schema
(`src/models/character.mts`), the ADRs, and `docs/` — when a frame lags
or contradicts those, the schema wins on content and Figma wins on look.
The live client may still lag — see **ui-navigation-playbook**. Adapt MCP
output to this stack (vanilla HTML/CSS/JS, ADR-012, **styling** /
**hypertext**).

- File: https://www.figma.com/design/n61wtRUXEaxhSc2gnL640J/Ahani.Base
- `fileKey`: `n61wtRUXEaxhSc2gnL640J`
- Page: `Webpage` (`0:1`)

Parse share URLs as `fileKey` + `node-id` (hyphens → colons for MCP
`nodeId`). Ignore `t=` query params. Local Variables only — no published
library / Code Connect.

## Canonical view frames

| App view | Figma frame | `node-id` | MCP `nodeId` |
| --- | --- | --- | --- |
| Welcome / initial | `initial` | `1021-58` | `1021:58` |
| Dashboard | `menu` | `1021-4` | `1021:4` |
| Creation form | `creation` | `1021-62` | `1021:62` |
| Character view | `view` | `1021-66` | `1021:66` |

To explore further: Figma MCP `get_metadata` on `fileKey` (omit `nodeId`
for page list) or on `0:1`.

## How to read design

On UI work that should match the redesign:

1. Pick the frame from the table (or discover via `get_metadata`).
2. `get_variable_defs` on that node for tokens (e.g. `Color/Main`,
   `Fonts/Display`) — do not invent hex/fonts from memory.
3. `get_design_context` for structure/screenshot (load
   `figma-design-to-code` first when implementing).
4. Map tokens into CSS custom properties under `:root` when landing them
   in code; keep Figma as the design-side source. Do not dump the full
   token table into this rule or into comments — fetch live.
