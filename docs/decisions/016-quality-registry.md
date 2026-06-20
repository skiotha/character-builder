# ADR-016: Quality Registry as Single Source of Truth for Boilerplate Effects

**Status:** Accepted
**Date:** 2026-04-27
**Deciders:** Project owner + Copilot design session
**Related:** [ADR-014](014-per-slot-combat-special-attacks.md) (Per-Slot Combat),
[ADR-015](015-typed-effect-targets-final.md) (Typed Effect Targets)

## Context

Most weapon and armor qualities in the Nagara catalog map to a small fixed effect:
`fortified` adds `+1` to the wearer's `secondary.armor`; `deep_wounds` adds `+1` to a
weapon's `baseDamage`; `flexible` toggles a flag; and so on. As Chunk E crystallized
the engine's per-slot fanout and ADR-015 locked the effect vocabulary, two authoring
problems became unavoidable:

1. **Boilerplate duplication.** With no registry, the only place to encode each
   quality's mechanical effect would be the per-item `effects[]` array. Every weapon
   that carries `deep_wounds` would copy the same `{ target: { kind: "combat",
   field: "baseDamage" }, modifier: { type: "addFlat", value: 1 } }` block, and that
   block would also need re-translating into `<topic>.ru.json`. The reference catalog
   already has dozens of weapons and a comparable set of armor; Chunk F's bulk
   authoring pass would multiply this by every new entry.

2. **Drift risk.** Any time the canonical mechanic of a quality changes (e.g.
   `fortified` becomes `+2` instead of `+1`), every entry that copied the boilerplate
   needs to be hand-edited. Missing one is a silent stat bug.

A separate ADR draft also considered merging `<topic>.en.json` and `<topic>.ru.json`
into a single file with embedded `LocalizedString` nodes, projected at read time.
That direction was abandoned: the only real win was a marginal authoring DX
improvement, while costs accumulated (loader split, projection helper, migration
script, sibling-project migration, parametric-quality test paths, locale-key
collision rule). The narrower drift-prevention goal is met by a tiny CI lint test
that compares non-localized fields between locales — see
[phase6-chunkF-prereqs-plan.md](../../.github/plans/done/phase6-chunkF-prereqs-plan.md)
Task 1. Locale files stay split.

## Decision

### 1. New reference catalog: `reference/qualities.{en,ru}.json`

Two files, one per supported locale, paralleling the other reference catalogs.
Each entry maps a quality id to its localized display strings and its canonical
mechanical effects:

```jsonc
{
  "id": "fortified",
  "name": "Fortified",
  "description": "+1 to wearer's armor.",
  "effects": [
    {
      "target": { "kind": "secondary", "stat": "armor" },
      "modifier": { "type": "addFlat", "value": 1 }
    }
  ]
}
```

- **`id`** — string. Globally unique across the registry (single namespace; see §3).
- **`name`, `description`** — optional, locale-specific. May differ between
  `<…>.en.json` and `<…>.ru.json`. May be absent in either or both.
- **`effects`** — `ResolvedEffect[]` (the same shape used by `weapon.effects[]` /
  `armor.effects[]`). **Identical across both locale files.** The locale-drift
  lint enforces this.

Purely-flavour qualities (e.g. `own`) get an entry with `effects: []`. The
registry still gives them a single canonical place to carry a localized name
and description.

### 2. Engine fanout

Two minimal touch points (~20 lines total):

1. **`buildSlot` in `src/rules/derived.mts`** — after the existing
   `weapon.effects[]` loop, walk `weapon.qualities`, look up each id in the
   registry, and append the registry's effects with implicit
   `appliesTo = { kind: "id", values: [weapon.id] }`. This mirrors the per-slot
   scoping of `weapon.effects[]` from Chunk E.

2. **`collectAllEffects` in `src/rules/effects.mts`** — after the existing armor
   `effects[]` walk, walk `armor.body?.qualities` and `armor.plug?.qualities`,
   look up each id, and append registry effects globally. This mirrors the
   global scoping of `armor.effects[]`.

The implicit `appliesTo` for weapon qualities means a quality on the main-hand
weapon does not bleed into the off-hand or own-weapon slot. Authors who want
broader scoping define a bespoke trait and use `appliesTo` explicitly there.

### 3. Single namespace

All quality ids live in one flat keyed map, regardless of whether they appear
on weapons, armor, or both. If a quality appears on both, that's intentional and
means the same mechanics. The loader asserts global id uniqueness on load.

The `EffectTarget` discriminator in [ADR-015](015-typed-effect-targets-final.md)
(`weaponQuality` vs `armorQuality`) is **not** about classifying registry
entries — it classifies what an *external* mutator (typically a trait) wants to
add or remove. For example, "Polearm Mastery adds the `reach` quality to
polearms" emits an effect with `target.kind = "weaponQuality"`. The registry
itself doesn't carry that distinction.

### 4. Authoring rule

After this refactor, item-level `weapon.effects[]` and `armor.effects[]` are
reserved for genuinely bespoke, one-off magic items — an artifact sword whose
effect doesn't apply to any other weapon, for instance. Standard mechanical
effects all live in the quality registry. This is the property that prevents
the drift problem from recurring during Chunk F authoring.

A weapon may simultaneously carry both registry-driven qualities and a bespoke
`effects[]` — both fire. The registry contributes the boilerplate, `effects[]`
contributes the unique twist.

### 5. Engine loads `DEFAULT_LOCALE` only; localized fields are display-only

The engine loads exactly one locale (= `DEFAULT_LOCALE`, currently `en`) at
startup and uses it for the lifetime of the process. Localized fields (`name`,
`description`) are dead weight in the engine's in-memory copy, but the
locale-drift lint guarantees `effects[]` is identical across both locale
files, so the choice is arbitrary and safe.

**Invariant:** the engine MUST NOT branch on any localized field value. A
future contributor who writes `if (quality.description === "…")` is introducing
a silent locale-dependent stat bug. This invariant applies to all reference
catalogs, not just qualities.

The `/api/v1/qualities` endpoint serves the locale resolved from the request
(`?locale=` → `Accept-Language` → `DEFAULT_LOCALE`), independent of the
engine's load locale.

### 6. Parametric qualities

Qualities with discrete magnitude variants (`fortified` at `+1`, `+2`, `+3`)
encode the magnitude as an id suffix: `fortified`, `fortified_2`, `fortified_3`.
Each is an independent registry entry. Predicate matching is unaffected — each
id is just a string.

Promote to a structured form (e.g. `Weapon.qualities: Array<string | { id;
rank }>`) only if a real authoring case appears that string encoding can't
express. Today's catalog has no such case.

### 7. Strictness

Two-stage runtime behaviour for unknown quality ids referenced from
`weapon.qualities` / `armor.{body,plug}.qualities`:

- **While the catalog is empty** (Chunk F.0c–F.0d): warn-once-per-id, skip.
  Engine output stays identical to Chunk E. Mirrors the Chunk C empty-trait-
  registry pattern.
- **Once the catalog is populated** (Chunk F.0e onwards): throw on unknown id
  during recalc. Authoring mistakes fail fast.

Load-time validators ("every quality id mentioned by any weapon/armor entry
resolves in the registry"; "every registry effect target is structurally sane")
land in Chunk G alongside the trait/talent/ritual registry validators.

### 7a. Out of scope: full structural validation of reference catalog entries

The strictness rule above (§7) covers two narrow checks: quality-id
*membership* (every id referenced from a weapon/armor entry exists in the
registry) and registry-side *effect-target shape* (every `ResolvedEffect`
inside the registry parses). It deliberately does **not** cover full
structural validation of the surrounding catalog entries — i.e. asserting at
load time that every entry in `reference/weapons.*.json`,
`reference/armor.*.json`, `reference/abilities.*.json`, etc. conforms to the
typed shape declared in `src/rpg-types.mts` (required fields present,
optional fields the right type, no stray keys, no shape errors inside
authored `effects[]` arrays on items themselves).

Rationale:

- **Reference catalogs are author-controlled JSON, not user input.** A
  malformed catalog is an authoring bug, not an attack surface. The trusted-
  userbase assumption from [ADR-003](003-self-asserted-player-identity.md)
  applies here too: catalog authors are a small known set.
- **The audit lint covers the most painful drift cases already.** Locale-
  drift (`{en,ru}` structural parity), action-id uniqueness across tiers and
  parents, quality-id membership, and (post-Chunk-G) trait/spell/ritual id
  resolvability are all enforced by `scripts/audit-reference.mts` and
  `test/reference-locale-drift.test.mts`. These are the failure modes that
  have actually bitten authors.
- **ADR-001 forbids runtime schema-validation dependencies.** Full structural
  validation means hand-rolled validators per top-level shape (`Weapon`,
  `ArmorPiece`, ability tier, spell tier, ritual entry, status). That is real
  code to write and maintain. Until the catalog is large enough or the
  authoring pipeline is loose enough that typos-in-prod become a recurring
  problem, the cost outweighs the benefit.

Consequence: a typo like `damge: 3` in a weapon entry loads silently. The
weapon's `damage` reads as `undefined`, downstream recalc produces wrong
numbers or throws far from the cause, and the author discovers it in a
sibling-app render rather than a load-time error.

**When to revisit.** Promote this from deferred to scoped work when *any* of:

- A catalog-authoring typo reaches production and causes a player-visible bug.
- The catalog grows past the point where author code-review reliably catches
  shape errors (rule of thumb: more than one new entry per week, sustained).
- Phase 7 sibling integration introduces a programmatic catalog-write path
  (e.g. the addon writes home-brew weapons back to the website) — at that
  point catalog entries *are* user input and §7a no longer holds.

This deferred capability is tracked as
[#34 in `.github/bugs/api-infra-bugs.md`](../../.github/bugs/api-infra-bugs.md).
The in-code anchor is the Weapon/ArmorPiece preamble comment in
`src/rpg-types.mts`.

### 8. `/api/v1/qualities` endpoint

Sixth case in the [src/app.mts](../../src/app.mts) handleApi switch, parallel
to `traits` / `talents` / `rituals` / `weapons` / `armor`. Locale resolution
follows the same convention: `?locale=` query → first matching primary subtag
in `Accept-Language` → `DEFAULT_LOCALE`. Unknown locale → 400. Sibling projects
(Discord bot, WoW addon) may consume it for tooltip rendering.

## Stable anchors

Code cites these with `ADR-016 §<anchor>`. `test/adr-anchors.test.mts`
asserts every such citation resolves to a row below.

| Anchor | Rule |
| --- | --- |
| `§7a` | full structural validation of reference-catalog entries against their typed shapes is deliberately out of scope (author-controlled data); tracked as `api-infra-bugs.md #34`. |

## Consequences

### Positive

- Each quality's mechanic is authored once. Catalog-wide changes are one-line edits.
- Item-level `effects[]` shrinks to genuinely bespoke entries — Chunk F bulk
  authoring stays tractable.
- Localized quality names and descriptions live in one place, ready for
  client-side and sibling-project tooltips.
- The single namespace eliminates a class of authoring confusion ("is `flexible`
  a weapon or armor quality?" — answer: it's a quality, that's all).
- The engine never branches on locale, so locale-dependent stat bugs are
  structurally impossible.

### Negative / costs

- One additional reference catalog to maintain (`qualities.{en,ru}.json`).
- A new `Registry.lookupQuality` method to keep wired through the engine and
  test fixtures.
- The two-stage strictness adds a brief asymmetry between F.0c and F.0e where
  the engine warns rather than fails on unknown ids; clearly time-boxed.

### Neutral

- Sibling projects (Discord bot, WoW addon) gain a new file and a new endpoint
  to consume. Neither is a breaking change — existing endpoints and files are
  untouched.

## Alternatives Considered

### Inline `effects[]` on every weapon and armor entry

Rejected. This is the pre-ADR baseline. Boilerplate duplication and drift risk
scale linearly with catalog size; Chunk F would multiply both.

### Separate weapon-quality and armor-quality registries

Rejected. Some qualities (e.g. `composite`) appear on both. A split would
either force the same id to be authored twice or invent a third namespace for
shared qualities. The flat keyed map is simpler and avoids the lookup-chain
complexity.

### Single-file locale-merged catalog with `LocalizedString` nodes

Rejected. See Context. Drift defence is achieved more cheaply by a CI lint
test, with no shape change, no projection helper, no migration, and no
sibling-project impact.

### Structured parametric qualities up-front

Deferred. String-encoded ids cover today's catalog and keep the type surface
narrow. Promote only when a real case emerges.

## References

- [phase6-chunkF-prereqs-plan.md](../../.github/plans/done/phase6-chunkF-prereqs-plan.md)
- [ADR-014](014-per-slot-combat-special-attacks.md)
- [ADR-015](015-typed-effect-targets-final.md)

See also: [docs/reference-authoring.md](../reference-authoring.md) for the practical authoring guide that consumes this decision.
