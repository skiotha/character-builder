---
applyTo: "**"
---

# Engineering conventions — comments, citations & plan bookkeeping

These conventions are project-agnostic and shared across our repositories.
Each repo's own `copilot-instructions.md` supplies the concrete bindings —
which decision records, which docs, which bug tracker, which enforcing tests —
while this file states the rules those bindings instantiate.

## Why these rules

Code comments, doc-comments, and test titles outlive the work that produced
them. If they cite **ephemeral** sources — work plans, phase or chunk names,
numbered plan items — the citation rots the moment that plan ships and is
archived, leaving a comment that points at nothing. So comments cite only
**stable** surfaces, and the few unavoidable references to in-flight work are
quarantined behind a tag whose lifetime matches the plan's.

## Stable vs. ephemeral citations

- Comments, doc-comments, and test titles may cite **stable** surfaces:
  architecture decision records (and their named stable anchors), durable
  design / architecture / data-contract docs, and bug-tracker ids.
- They must **not** cite **ephemeral** sources: work plans, phase / chunk /
  milestone names, or numbered plan items. Plans are short-lived and get
  archived once shipped.
- The **one** allowed reference to an in-flight plan is inside a
  `TODO(<scope>)` (see tags below) whose lifetime matches the plan's — the
  TODO and its citation are removed together when the plan ships.

## Comment-tag taxonomy

- `TODO(<scope>)` — a missing capability; `<scope>` names the capability, not
  the plan. May append a pointer to the tracking plan; remove both when it ships.
- `FIXME(<scope>)` — a known-broken code path; cite the relevant bug-tracker id.
- `NOTE:` / plain `//` — stable explanatory prose; never cites a plan.

## Plan bookkeeping

- Every active plan carries a **"References to sweep on completion"** section
  listing the code-side `TODO(<scope>)` sites to revisit when it ships. An
  empty list is fine and is stated explicitly, so the obligation is "follow
  the checklist", not "remember to grep".

## Decision-record anchors

- When citing inside a decision record, cite a **named stable anchor** from
  that record's "Stable anchors" table, never a bare heading number — heading
  numbers get renumbered, named anchors do not.

## Code-documentation ladder

Written code carries explanatory comments at three scales. **Default to the
smallest scope that fully documents the contract.**

- **Module header** — a top-of-file block for any non-trivial module: its
  purpose, where it sits in the larger flow, and the cross-cutting invariants
  it relies on.
- **Function doc-comment** — above any function whose contract isn't obvious
  from its signature: describe **what it guarantees** (not a line-by-line
  retelling) and any preconditions or ordering it depends on.
- **Inline `//` comment** — for non-obvious branches, ordering / reset markers,
  and the *why* (cite the decision record or bug id; don't restate the rule).

Don't comment trivial mechanics. Do comment invariants, non-obvious orderings,
and gotchas that already burned someone. When you change a behaviour a comment
describes, update the comment in the same edit — stale doc-comments are worse
than missing ones.
