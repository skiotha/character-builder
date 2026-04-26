# Phase 6 Chunk F Prerequisites — Locale Merge & Quality Registry

> **Status:** Not started.
> **Gate:** Must complete before [phase6-plan.md § Chunk F](phase6-plan.md#chunk-f--effect-normalization-data).
> Chunk F's bulk authoring pass operates on the merged-locale, registry-aware shape from the very first edit; doing F first and then refactoring would mean re-touching every file twice.
>
> **Why a separate plan:** two non-trivial, mostly-independent reference-data refactors. Each touches every reference file and ships its own ADR. Doing them together with the Chunk F authoring pass would conflate three concerns (shape migration, mechanical normalization, translation) and make the diff unreviewable. Each refactor here is mechanical and tool-driven; Chunk F is hand-authoring and creative.

---

## Background

Two structural problems surfaced during the post-Chunk-E review:

1. **Locale duplication.** `reference/<topic>.en.json` and `reference/<topic>.ru.json` differ only in the values of three fields per entry (`name`, `description`, `tags`) plus per-effect `description`. Everything else — `id`, `category`, `source`, `tiers.*.effects[].target`, `tiers.*.effects[].modifier` — is byte-identical and **must** stay byte-identical for the engine to work. Maintaining this invariant by hand across 14 files invites silent mechanical drift between locales (e.g. `value: 4` in en, `value: 5` in ru).

2. **Quality boilerplate.** Most weapon and armor qualities are mechanically equivalent to a small fixed effect (e.g. `fortified` = `+1 armor`, `deep_wounds` = `+1 baseDamage`). With the current shape we'd have to copy that effect into every weapon/armor entry that carries the quality and re-translate it 14 times. Authoring fatigue + drift risk.

Both issues compound during the Chunk F bulk authoring pass — the larger the catalog grows, the more files would need to be re-edited.

---

## Task 1 — Single-File Locale Merge

### Decision

Replace the per-locale split with a single source-of-truth file per topic. Localized strings become objects keyed by locale; the loader projects to the requested locale on read.

```
reference/abilities.en.json   ┐
reference/abilities.ru.json   ┘ → reference/abilities.json
```

Same for `spells`, `boons`, `sins`, `rituals`, `weapons`, `armor`. Seven files, no duplication.

### Authored shape (per-entry)

```jsonc
{
  "id": "acrobatics",
  "category": "ability",
  "source": "03-reference/abilities",
  "name":        { "en": "Acrobatics",        "ru": "Акробатика" },
  "description": { "en": "Mobility and …",    "ru": "Подвижность и …" },
  "tags": {
    "en": ["mobility", "defense", "melee"],
    "ru": ["мобильность", "защита", "ближний"]
  },
  "tiers": {
    "novice": {
      "description": { "en": "…", "ru": "…" },
      "effects": [
        {
          "tier": "B",
          "target": { "kind": "flag", "name": "freeAttackImmunity" },
          "description": { "en": "…", "ru": "…" }
        }
      ]
    }
  }
}
```

**Invariant:** any node whose own keys are exactly a subset of `SUPPORTED_LOCALES` is treated as a `LocalizedString` and replaced with the requested locale's value. No domain field name collides with a locale code (`en`, `ru`).

### TypeScript shape

In `src/rpg-types.mts` (or a new `src/lib/locale.mts` companion):

```typescript
export const SUPPORTED_LOCALES = ["en", "ru"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export type LocalizedString = { [K in SupportedLocale]?: string };
export type LocalizedStringArray = { [K in SupportedLocale]?: string[] };
```

### Loader change ([src/models/reference.mts](../../src/models/reference.mts))

- File resolution becomes topic-only: `reference/${topic}.json`. The current per-locale path is gone.
- Cache keying stays `(topic, locale)` so HTTP-side behaviour (locale resolution, mtime invalidation, merge semantics for traits/talents) is unchanged.
- New helper `project<T>(node: unknown, locale: SupportedLocale): T` walks the loaded tree once and replaces every `LocalizedString` node with the chosen locale's value (with `en` fallback when the requested key is missing).
- Strict-mode option (env or constant): warn when a `LocalizedString` is missing the `en` fallback, since it becomes the silent default.

### Migration script

`scripts/merge-locales.mts` (one-shot, kept in repo for audit):

1. For each topic: load `<topic>.en.json` and `<topic>.ru.json`.
2. Pair entries by `id`. Error if any id is in only one file.
3. Walk both trees in parallel. At each leaf:
   - If the field is in the localized-key set (`name`, `description`, `tags`, per-effect `description`): merge into a `LocalizedString` / `LocalizedStringArray`.
   - Otherwise: assert deep-equal between en and ru. **Fail loud on mismatch** — that's exactly the silent drift this whole refactor is designed to prevent. Print a precise diff and abort. The user reviews, picks the correct value, edits one of the input files, re-runs.
4. Emit `<topic>.json`. Pretty-print with stable key order (id first, then category/source, then localized leaves, then tiers).
5. Print a per-topic summary: entry count, total `LocalizedString` nodes synthesized, drift conflicts that needed resolution.

The script is destructive only in the sense that it produces a new file; the originals are deleted by a separate human-confirmed step (`git rm reference/*.{en,ru}.json` after manual diff review).

### Test changes

- New: `test/locale-projection.test.mts` covering the `project` helper — match-all-locales node, partial node (missing `en`, missing `ru`), nested arrays, deeply nested objects, non-localized objects pass through untouched, primitive leaves pass through untouched.
- Update: `test/reference.test.mts` and `test/locale.test.mts` use the new file layout. Their behavioural expectations (locale resolution, mtime caching, merge id-uniqueness) are unchanged.

### ADR

**ADR-016 — Single-file reference catalog with embedded localization.**

Captures: the `LocalizedString` shape; the locale-key-detection invariant; loader projection at read time; migration policy (deep-equal assertion as drift guard); fallback policy (en when requested locale missing); and explicit non-goals (no message-format/ICU support, no plural rules, no client-side projection — all done server-side).

### Sibling-project impact

Both [nagara-addon](https://github.com/skiotha/nagara-addon) and [malizia](https://github.com/skiotha/malizia) currently load both locale files from disk. Two clean migration paths:

- **(a)** Sibling projects implement the same `project` helper locally (~30 lines each). Loose coupling preserved.
- **(b)** The web app exposes the projected shape over HTTP only (already the case). Sibling projects switch to consuming the API instead of reading files. Tighter coupling, but only one place that knows the shape.

Document the choice in `docs/data-contracts.md` and notify both repos before deleting the legacy `.en.json` / `.ru.json` files. **Keep the old files for one release cycle** as a safety net — sibling projects pin to a Nagara website version anyway.

### Open decisions

1. **`tags` field.** Currently translated word-for-word (e.g. `мобильность`). Options:
   - Treat as display labels → `LocalizedStringArray` (this plan's default).
   - Canonicalize to en-kebab-case identifiers, UI maps to display labels → cleaner long-term but invasive now.

   **Recommendation:** display labels for now. Promote to identifiers only when something starts filtering on tag values mechanically.

2. **Strict mode default.** Loader warns or errors on missing `en` fallback?
   **Recommendation:** error in dev, warn in prod (mirrors existing config patterns).

---

## Task 2 — Quality Registry

### Decision

Introduce `reference/qualities.json` (single file, locale-merged via Task 1's projection). Each entry maps a quality id to its mechanical effects:

```jsonc
{
  "id": "fortified",
  "name":        { "en": "Fortified",        "ru": "Укреплённое" },
  "description": { "en": "Reinforced…",      "ru": "Усиленная…" },
  "effects": [
    {
      "source": "quality:fortified",
      "target": { "kind": "secondary", "stat": "armor" },
      "modifier": { "type": "addFlat", "value": 1 }
    }
  ]
},
{
  "id": "deep_wounds",
  "name":        { "en": "Deep Wounds",      "ru": "Глубокие Раны" },
  "description": { "en": "Cuts that bleed…", "ru": "Порезы, которые…" },
  "effects": [
    {
      "source": "quality:deep_wounds",
      "target": { "kind": "combat", "field": "baseDamage" },
      "modifier": { "type": "addFlat", "value": 1 }
    }
  ]
}
```

### Single namespace

Per user direction: **all qualities are unique across weapons and armor.** If a quality name appears on both, that's intentional and means the same mechanics. The registry is a flat keyed map. Loader asserts global id uniqueness on load.

The `EffectTarget` discriminator (`weaponQuality` vs `armorQuality`) in ADR-015 is **not** about classifying registry entries — it's about what an external trait wants to mutate (e.g. "Polearm Mastery adds the `reach` quality to polearms" → `weaponQuality`). Registry entries don't need or carry that distinction.

### Engine wiring

Two minimal touch points:

1. **`src/rules/derived.mts#buildSlot`** — after the existing `weapon.effects[]` loop, also walk `weapon.qualities` and append the registry's effects for each, with implicit `appliesTo = this weapon` (same scoping as `weapon.effects[]`).
2. **`src/rules/effects.mts#collectAllEffects`** — after the existing armor effects walk, also walk `armor.body?.qualities` and `armor.plug?.qualities` and append registry effects globally (same scoping as `armor.effects[]`).

Total engine diff: ~20 lines + a registry-loader import.

### Authoring rule

After this refactor, `weapon.effects[]` and `armor.effects[]` should be **rare** — reserved for genuinely bespoke, one-off magic items (e.g. an artifact sword whose effect doesn't apply to any other weapon). Standard mechanical effects all live behind quality ids. This is the property that prevents drift.

### Validation

- **Load-time:** reference loader rejects unknown quality ids referenced from weapons/armor with a clear error citing the offending file/entry. Configurable strictness.
- **Lint test** (Chunk G): "every quality id mentioned by any weapon/armor entry resolves in the quality registry" + "every registry entry's `target.kind` is structurally sane (no `weaponQuality` self-reference loops)".

### Edge cases

1. **Purely-flavour qualities** (`own`, possibly `hampering` etc. — TBD which are mechanical). Get registry entries with `effects: []`. Still useful — gives them a localized display name in one place.
2. **Parametric qualities** (`fortified +1` vs `fortified +2`). String-encode the magnitude into the id (`fortified_2`) for now. Promote `Weapon.qualities` from `string[]` to `Array<string | { id; rank }>` only if a real case appears that string encoding can't express. Predicate matching survives unchanged either way.
3. **Quality whose effect logically only applies in one context** (e.g. `fortified` on a weapon would bump the wearer's armor stat — odd but harmless). Engine doesn't police; lint test in Chunk G optionally warns. Author responsibility.
4. **Quality + bespoke effect on the same item.** Both fire. The registry contributes the boilerplate, `effects[]` contributes the unique twist. No conflict.
5. **Predicate-vs-effect role overlap.** A quality can simultaneously be a mechanical effect source AND a predicate target (e.g. `heavy` has its own effect AND is what an external trait targets via `appliesTo`). That's fine — predicates match against the quality name, registry matches against the quality id, both lookups are decoupled.

### ADR

**ADR-017 — Quality registry as single source of truth for boilerplate effects.**

Captures: the single-namespace rule (no weapon/armor split); registry as the canonical place for any non-bespoke effect; the implicit-`appliesTo` scoping (per-weapon for weapon-mounted qualities, global for armor-mounted); the "bespoke `effects[]` is rare" authoring rule; the `target.kind` clarification (registry entries don't classify themselves; the discriminator is for external mutators); and the parametric-quality string-encoding stance.

### Migration content

The current `reference/weapons.{en,ru}.json` and `reference/armor.{en,ru}.json` already use bare quality strings (e.g. `"qualities": ["hampering", "flexible"]`). **No content change is required** in those files for Task 2 itself — only:

1. Create `reference/qualities.json` with one entry per distinct quality currently appearing on any weapon or armor.
2. For each entry: provide localized name + description (lifted from the rules vault `rpg/{en,ru}/`) and the canonical effect list (the user authors this — Copilot can scaffold).
3. Wire engine consumers (Task 2's two engine touch points).
4. Optional: scrub any pre-existing `effects[]` that duplicate quality boilerplate (likely none today; future-proofing for Chunk F).

The qualities catalog is small enough (~30–60 entries from a quick scan) to author in one sitting once the shape is locked.

---

## Suggested Sequencing

Tasks 1 and 2 are independent in principle, but Task 2's `qualities.json` ships in the merged-locale shape from day one, so Task 1 should land first.

### F.0a — ADR-016 (locale merge) ← Copilot
Draft and land the ADR. Includes the `LocalizedString` shape, projection semantics, fallback policy, deep-equal-assertion migration policy. ~150-line ADR.

### F.0b — ADR-017 (quality registry) ← Copilot
Draft and land. Captures all "Decision" / "Edge cases" content above. ~120-line ADR.

### F.0c — Loader projection helper ← Copilot
Add `project()` to `src/models/reference.mts` (or new `src/lib/locale-projection.mts`). Add unit tests. Loader still resolves per-locale files; projection is a no-op until F.0d. Zero behavioural change. Verifies the helper in isolation.

### F.0d — Migration script + run ← Copilot writes script, user runs and reviews
Run on each topic. Resolve any drift the script flags (manual). Commit the merged files. Update loader to read topic-only files. Delete old `<topic>.{en,ru}.json` (or move to `archive/` for one cycle).

### F.0e — Quality registry: shape + loader ← Copilot
Add registry types; wire `collectAllEffects` and `buildSlot`. Ship with `reference/qualities.json` empty `[]` and lint disabled. Engine pipeline is byte-identical to Chunk E output until F.0f populates the registry.

### F.0f — Populate `reference/qualities.json` ← user with Copilot scaffold
Author one entry per existing quality. Enable load-time strictness. Run full test suite to confirm no regressions.

### F.0g — Sibling-project doc updates ← Copilot
Update `docs/data-contracts.md`, `docs/addon-integration.md`, `docs/bot-integration.md` with both shape changes. Cross-reference both ADRs. Note legacy file retention policy.

After F.0g lands, the gate is open and the original [Chunk F](phase6-plan.md#chunk-f--effect-normalization-data) authoring pass can begin, operating on the merged + registry-aware shape from edit one.

---

## Verification

- `npm run typecheck` clean after each sub-step.
- `npm test` green; new tests cover `project()` (locale projection) and the quality-registry-resolution path.
- Manual: `/api/v1/traits?locale=ru` returns the same projected shape as today (clients see no diff).
- Manual: a synthetic character with `equipment.armor.body.qualities = ["fortified"]` shows `+1` in derived `secondary.armor` after recalc, with `reference/qualities.json` containing the `fortified` entry and **no** `effects[]` on the armor entry itself.
- Manual: removing the `fortified` entry from the registry causes the loader to error on character recalc (or warn, per strictness setting), citing `armor.body.qualities[0]`.
- Migration script run is idempotent: re-running on already-merged files is a no-op (or fails loud if someone hand-edited a leaf into a partial `LocalizedString`).

---

## Out of Scope

- The Chunk F bulk authoring pass itself (this plan only sets the shape it operates on).
- Real registry loader for traits/talents/rituals (that's Chunk G).
- Vocabulary lock for `EffectFlag` and `WeaponPredicate.kind=quality` value space (touched on in Chunk F authoring spec; deciding the exhaustive enum is post-F).
- Catalog reconciliation between `weapons.json` damage values and the schema-default `natural_weapon` (separate user-driven call, see Chunk E memo).
- Sibling-project code changes (web app's job is to expose the projected shape; sibling repos own their consumption migration).

---

## Locked Decisions

- **Single-file per topic** with embedded `LocalizedString`. (User confirmed.)
- **Single quality namespace** — no weapon-vs-armor registry split. (User confirmed.)
- **All non-bespoke effects live in `qualities.json`**; `weapon.effects[]` / `armor.effects[]` reserved for one-off magic. (User confirmed.)
- **Implicit `appliesTo`** stays the same as Chunk E: per-weapon for weapon qualities, global for armor qualities.
- **Migration policy:** deep-equal assertion on non-localized fields between en/ru, fail loud on drift, manual resolution.
- **Two ADRs**, one per task — they're orthogonal and citable independently.
