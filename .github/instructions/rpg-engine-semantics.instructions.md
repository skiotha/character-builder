---
applyTo: "src/rules/**, src/rpg-types.mts"
---

# RPG engine semantics — consult the contract first

- [`docs/rpg-engine-semantics.md`](../../docs/rpg-engine-semantics.md) is the
  canonical statement of the RPG-system facts this engine encodes. Read the
  relevant `ES §<anchor>` entries before changing engine semantics, and cite
  them where they justify a behavior.
- **Lockstep (same commit):** any change to rule-backed engine behavior —
  attributes, formulas, phase order, effect semantics, combat model, action
  policy — updates the digest in the same commit. New rule-backed behavior
  gets a new entry; removed behavior removes its entry. Refactors, renames,
  perf work, and tests never touch the digest.
- **Doc → reality:** every digest entry resolves to code or a tracked gap
  (`TODO(<scope>)` / `NB-<n>`). If your change opens or closes such a gap,
  update the entry's **Where** facet.
- `ES §<anchor>` cites are **not** lint-enforced (unlike `ADR-NNN §anchor` /
  `NB-<n>`) — keeping them resolving is a discipline obligation.
