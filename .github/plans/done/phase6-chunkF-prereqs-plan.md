# Phase 6 Chunk F Prerequisites — Quality Registry & Locale-Drift Lint

> **Status:** Done (F.0a–F.0f complete, 2026-04-27). Quality registry
> shipped; engine throws on unknown ids; `/api/v1/qualities` live;
> qualities catalog scaffolded id-only (en+ru) with content authoring
> deferred to Chunk F bulk pass; docs updated.
> **Gate:** Must complete before [phase6-plan.md § Chunk F](../phase6-plan.md#chunk-f--effect-normalization-data).
> Chunk F's bulk authoring pass operates on the registry-aware shape from edit one — adding the registry afterwards would mean re-touching every weapon and armor entry to strip duplicated boilerplate.
>
> **Why a separate plan:** the quality registry refactor crosses engine code, reference data, the loader, the API, tests, and three doc files. Doing it inline with Chunk F's hand-authoring pass would conflate mechanical refactor with creative authoring and make the diff unreviewable.
>
> **History:** an earlier draft of this plan also proposed a single-file locale merge (one `<topic>.json` per topic with embedded `LocalizedString` nodes, projected at read time). It was scrapped after a design pass: the only real benefit was a marginal authoring DX win, while costs accumulated (loader split, projection helper, migration script, sibling-project migration, new ADR, doc churn, parametric-quality test paths, locale-key collision rule). The drift problem the merge was meant to solve is fully addressed by a tiny CI lint test that compares non-localized fields between locales — see Task 1 below. Locale files stay split.

---

## Background

Two structural issues surfaced during the post-Chunk-E review:

1. **Silent en/ru drift on engine-relevant fields.** `<topic>.en.json` and `<topic>.ru.json` differ legitimately on `name`, `description`, and `tags`, but everything else (`id`, `category`, `source`, `tiers.*.effects[].target`, `tiers.*.effects[].modifier`, weapon `damage`, armor `armor`, quality lists, etc.) **must** stay byte-identical or the engine produces different stats for the same character depending on the requested locale. Hand-maintained today; nothing prevents drift.

2. **Quality boilerplate.** Most weapon and armor qualities are mechanically equivalent to a small fixed effect (e.g. `fortified` = `+1 secondary.armor`, `deep_wounds` = `+1 baseDamage`). Today this would be copied into every weapon/armor entry that carries the quality and re-translated in both locales. Authoring fatigue + drift risk that compounds with catalog growth.

---

## Task 1 — Locale-Drift Lint

### Decision

A single test (`test/reference-locale-drift.test.mts`) integrated into `npm test`. No separate script, no GitHub Actions wiring. CI will run the full test suite before deploy once that pipeline exists; local developers run `npm test` already.

### What the lint enforces

For each topic in `{abilities, spells, boons, sins, rituals, weapons, armor, qualities}` (qualities added in Task 2):

- Both `<topic>.en.json` and `<topic>.ru.json` must exist and parse.
- They must contain the same set of `id`s, in the same order.
- Walking both trees in parallel from each entry root, every leaf must deep-equal **except** for fields in the localized-fields allowlist.

### Localized-fields allowlist (uniform across all topics)

`name`, `description`, `tags`.

- The engine never reads any of these — they are display-only.
- `tags` may differ in length and content between locales (translator freedom; siblings handle as display labels).
- **Optional presence is permitted**: a localized field may be present in one locale and absent in the other (e.g. `description` on a weapon may exist only in the EN file). This is intentional — these fields aren't engine-relevant, and forcing parity adds a translation tax for zero correctness benefit. The lint skips comparison whenever a field name is in the allowlist, regardless of presence on either side.

### Failure mode

Print the JSON path of the first mismatch and both values, then fail. Example:

```
Drift in reference/weapons.{en,ru}.json:
  weapons[12].damage: en=8, ru=10
```

### Why a single uniform allowlist

Today abilities/spells carry `description` and `tags`; weapons/armor carry only `name`. The user may add `description` (and possibly `tags`) to weapons/armor during Chunk F. Picking a uniform allowlist now means the lint doesn't need updating per-topic when that happens.

### Test scope

`test/reference-locale-drift.test.mts` runs as a regular test under `npm test`. It uses the actual `reference/` directory (not a temp dir) so it reflects the live catalog state. One `describe` block per topic; one `it` per topic asserting (a) id-set equality with order, (b) recursive non-localized leaf equality.

---

## Task 2 — Quality Registry

### Decision

Introduce `reference/qualities.{en,ru}.json` mapping each quality id to its localized name + description and its canonical effects. Engine fans out registry effects with the same implicit `appliesTo` scoping as Chunk E `weapon.effects[]` / `armor.effects[]`. Item-level `effects[]` becomes rare (bespoke one-offs only).

### Per-entry shape

```jsonc
{
  "id": "fortified",
  "name": "Fortified",
  "description": "+1 to wearer's armor.",
  "effects": [
    {
      "target": { "kind": "secondary", "name": "armor" },
      "modifier": { "phase": "addFlat", "value": 1 }
    }
  ]
}
```

- `id`: string, globally unique across the registry (no weapon/armor split — single namespace per Chunk E memo).
- `name`, `description`: optional, locale-specific (different per file).
- `effects`: `ResolvedEffect[]`, **identical** across both locale files (lint enforces). May be `[]` for purely-flavour qualities like `own`.

### Engine wiring (~20 lines)

Two touch points:

1. **`buildSlot` in [src/rules/derived.mts](../../src/rules/derived.mts)** — after the existing `weapon.effects[]` loop, walk `weapon.qualities`, look up each id in the registry, and append the registry's effects with implicit `appliesTo = { kind: "id", values: [weapon.id] }` (i.e. scoped to the carrying weapon, mirroring `weapon.effects[]` semantics).

2. **`collectAllEffects` in [src/rules/effects.mts](../../src/rules/effects.mts)** — after the existing armor `effects[]` walk, walk `armor.body?.qualities` and `armor.plug?.qualities`, look up each id in the registry, and append registry effects globally (mirroring `armor.effects[]` semantics).

### Engine locale

Engine loads the registry once at startup using `DEFAULT_LOCALE` (= `en`). Localized fields (`name`, `description`) are dead weight in the engine's copy — engine MUST NOT branch on them. The locale-drift lint guarantees `effects[]` is identical across locales, so the choice is arbitrary and safe.

### Strictness

Two-stage:

- **F.0c–F.0d (registry empty):** unknown quality id (i.e. any id from a weapon/armor `qualities[]` not found in the empty registry) → `console.warn` once per id, skip. Engine output identical to Chunk E. Mirrors the Chunk C empty-trait-registry pattern.
- **F.0e (registry populated):** flip to throw on unknown id during recalc. Authoring mistakes fail fast.

### Parametric qualities

String-encoded magnitude in the id (`fortified_2`, `fortified_3`). Each is an independent registry entry. Predicate matching is unaffected — each id is just a string. Promote to structured `{ id, rank }` form only if a real case appears that string encoding can't express.

### Single namespace clarification

The `EffectTarget` discriminator (`weaponQuality` vs `armorQuality`) in ADR-015 classifies what an *external* trait wants to mutate (e.g. "Polearm Mastery adds the `reach` quality to polearms"). It does **not** classify registry entries. The registry is a flat keyed map; quality entries don't carry that distinction.

### Authoring rule

After this refactor, item-level `weapon.effects[]` and `armor.effects[]` are reserved for genuinely bespoke, one-off magic items. Standard mechanical effects all live in the registry. This is the property that prevents Chunk F authoring drift.

### `/api/v1/qualities` endpoint

Sixth case in the [src/app.mts](../../src/app.mts) handleApi switch (parallel to `traits`/`talents`/`rituals`/`weapons`/`armor`). Locale-resolved like the others (`?locale=` → `Accept-Language` → `DEFAULT_LOCALE`); unknown locale → 400. Sibling projects (Discord bot, WoW addon) may consume it for tooltip rendering.

### Validation deferred to Chunk G

Load-time validators — "every quality id mentioned by any weapon/armor entry resolves in the registry"; "every registry entry's effect target is structurally sane" — land in Chunk G alongside the trait/talent/ritual registry validators. F.0e ships the runtime warn/throw behaviour only.

---

## ADR

**ADR-016 — Quality registry as single source of truth for boilerplate effects.**

Captures: the single-namespace rule (no weapon/armor split); registry as the canonical place for any non-bespoke effect; the implicit-`appliesTo` scoping (per-weapon for weapon-mounted qualities, global for armor-mounted); the "bespoke `effects[]` is rare" authoring rule; the `target.kind` clarification (registry entries don't classify themselves; the discriminator is for external mutators); the parametric-quality string-encoding stance; the engine's `DEFAULT_LOCALE`-only registry load and the display-only invariant on localized fields.

The locale-drift lint is **not** a separate ADR — it's an implementation detail documented in [docs/data-contracts.md](../../docs/data-contracts.md).

ADR number `016` confirmed against [docs/decisions/README.md](../../docs/decisions/README.md) (last accepted is ADR-015).

---

## Sub-sequence

### F.0a — ADR-016
Write [docs/decisions/016-quality-registry.md](../../docs/decisions/016-quality-registry.md). Update the ADR index. ~120-line ADR.

### F.0b — Locale-drift lint
Add `test/reference-locale-drift.test.mts`. Topics covered initially: `abilities`, `spells`, `boons`, `sins`, `rituals`, `weapons`, `armor`. (`qualities` added in F.0c when the files exist.) Lint should pass on the current catalog — if it fails, those mismatches are real engine bugs to triage before continuing.

Parallelizable with F.0a.

### F.0c — Quality registry: types, loader, engine wiring
- Add `Quality` type to [src/rpg-types.mts](../../src/rpg-types.mts):
  ```typescript
  export interface Quality {
    id: string;
    name?: string;
    description?: string;
    effects: ResolvedEffect[];
  }
  ```
- Extend [src/models/reference.mts](../../src/models/reference.mts) with the `qualities` topic. Loader asserts global id uniqueness on load (single namespace).
- Add `lookupQuality(id: string): Quality | null` to the `Registry` interface in [src/rules/registry-types.mts](../../src/rules/registry-types.mts). Update the inline `emptyRegistry` in [src/app.mts](../../src/app.mts) accordingly.
- [src/rules/derived.mts](../../src/rules/derived.mts) `buildSlot`: after `weapon.effects[]` loop, walk `weapon.qualities`, look up each in `registry.lookupQuality`, append effects with implicit `appliesTo = { kind: "id", values: [weapon.id] }`.
- [src/rules/effects.mts](../../src/rules/effects.mts) `collectAllEffects`: after armor `effects[]` walk, walk `armor.body?.qualities` and `armor.plug?.qualities`, look up each, append registry effects globally.
- Unknown-id behaviour: warn-once-per-id, skip.
- Create empty `reference/qualities.en.json` and `reference/qualities.ru.json` (`[]`).
- Re-enable `qualities` in the F.0b drift lint.
- Tests:
  - Extend `test/rules/combat.test.mts` with a registry-driven weapon-quality case.
  - Add `test/rules/quality-registry.test.mts` covering: registry-driven armor-quality on body, registry-driven armor-quality on plug, parametric ids (`fortified_2` resolves independently from `fortified`), unknown id warns and recalc still completes, empty registry = engine output unchanged from Chunk E.
- Update test helpers `test/helpers/{temp-dir,http}.mts` to seed empty `qualities.{en,ru}.json` so existing tests don't break on the new topic.

Depends on F.0a, F.0b.

### F.0d — `/api/v1/qualities` endpoint
- New [src/routes/handleGetQualities.mts](../../src/routes/handleGetQualities.mts) following the factory pattern of the other five reference handlers.
- Wire as sixth case in the [src/app.mts](../../src/app.mts) handleApi switch.
- Export from `#routes`.
- Tests in `test/api.test.mts` mirroring the `/traits` block — locale resolution (query, Accept-Language, default), `?locale=fr` → 400, Cache-Control header, content matches loader output.

Parallelizable with F.0c after types land.

### F.0e — Populate qualities catalog
- Copilot scaffolds: scan `reference/weapons.{en,ru}.json` and `reference/armor.{en,ru}.json`, collect every distinct quality id, emit one entry per id into both locale files with `id` only (no `name`, no `description`, `effects: []`). User authors `name` + `description` + `effects` manually.
- Flip unknown-id behaviour in `buildSlot` and `collectAllEffects` from `warn` to throw.
- Verification: `npm test` green; manual smoke — character with `equipment.armor.body.qualities = ["fortified"]` and a populated `fortified` registry entry of `+1 secondary.armor` shows the bonus in derived stats; removing the entry from the registry causes recalc to throw.

Depends on F.0c, F.0d. User-driven content authoring; Copilot's role ends after the id scaffold.

### F.0f — Docs updates
- [docs/data-contracts.md](../../docs/data-contracts.md): add a section on the quality registry (file shape, single namespace, engine fanout, implicit `appliesTo`, parametric ids), the `/api/v1/qualities` endpoint, and the locale-drift lint policy + localized-fields allowlist.
- [docs/bot-integration.md](../../docs/bot-integration.md), [docs/addon-integration.md](../../docs/addon-integration.md): list the new `qualities.{en,ru}.json` files, the `/api/v1/qualities` endpoint, and the drift-lint guarantee siblings can rely on.
- [.github/copilot-instructions.md](../../.github/copilot-instructions.md): add `qualities` to the reference catalog list and the API endpoint enumeration.
- [.github/plans/phase6-plan.md](../../.github/plans/phase6-plan.md): update the Chunk F.0 reference block to point at this rewritten plan; cross-reference the registry-resolution validator deferred to Chunk G.
- [.github/bugs/engine-weak-points.md](../../.github/bugs/engine-weak-points.md): new low-priority entry — slot-2 `own` quality validation should also assert the registry contains the `own` entry once the registry exists (currently only schema-layer check).

Depends on F.0e being merged or near-merge.

---

## Verification

1. After F.0b: `npm test` green; the new drift test asserts the seven existing topic pairs match on non-localized fields. If today's data fails the lint, those mismatches are real bugs to triage before continuing.
2. After F.0c: `npm test` green; engine output byte-identical to Chunk E for any character (registry empty, fanout no-op).
3. After F.0d: `curl http://localhost:8080/api/v1/qualities?locale=ru` returns the (initially empty) RU array; `?locale=fr` returns 400.
4. After F.0e: synthetic character with `armor.body.qualities = ["fortified"]` + populated `fortified` registry entry produces the expected derived `secondary.armor`; removing the entry causes recalc to throw, citing `armor.body.qualities[0]`.
5. After F.0e: `npm run typecheck` clean; full suite green; `engine-weak-points.md` entries #7/#9/#31 stay closed (this work doesn't reopen them).
6. Manual: parametric ids — `equipment.armor.body.qualities = ["fortified_2"]` resolves only the `fortified_2` registry entry, not `fortified`.

---

## Out of Scope

- **`rpg/` Markdown vault** — untouched. The vault is human-authored documentation, not engine data.
- The Chunk F bulk authoring pass itself (this plan only sets the shape it operates on).
- Chunk G work: full registry loader for traits/talents/rituals, registry-resolution validators (the F.0e strictness flip is runtime-only).
- Adding `description` / `tags` to weapons or armor entries (deferred to Chunk F authoring decisions).
- Sibling-project code changes (their consumption of the new files / endpoint is their own migration).

---

## Locked Decisions

- **Locale files stay split.** Drift defence = test-suite lint; no merge, no projection, no `LocalizedString` shape.
- **Lint integrated into `npm test`.** No separate `npm run lint:reference` script. No dedicated GH Actions step.
- **Localized allowlist uniform across topics:** `name`, `description`, `tags`. May differ between locales in length, content, or presence (any of them may be absent on either side).
- **Single quality namespace** — no weapon-vs-armor registry split.
- **All non-bespoke effects live in `qualities.{en,ru}.json`**; item-level `effects[]` reserved for one-off magic.
- **Implicit `appliesTo`** stays the same as Chunk E: per-weapon for weapon qualities, global for armor qualities.
- **Engine loads `DEFAULT_LOCALE` registry only**; localized fields are display-only and engine MUST NOT branch on them.
- **One ADR (016)** for the registry; the lint is a `data-contracts.md` paragraph.
- **Copilot scaffolds qualities ids only**; user authors `name`, `description`, `effects[]`.
- **Strictness: warn → throw at F.0e**.
- **Parametric qualities encoded as id suffix** (`fortified_2`); structured form deferred until needed.

---

## Further Considerations (deferred to Chunk F)

1. Add `description` field to weapons / armor entries during Chunk F? User leaning yes. Recommendation: defer to Chunk F authoring spec — not a F.0 blocker.
2. Add `tags` to weapons / armor / rituals (currently abilities + spells only)? User leaning uniform. Recommendation: also defer to Chunk F.
